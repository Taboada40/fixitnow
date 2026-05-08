import React, { useCallback, useEffect, useState, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    apiPost,
    apiPut,
    fetchLatestSessionProfile,
    mergeSessionProfile as persistProfileSession,
    useSession,
    resolveSessionProfileIdentifier
} from '../utils/profileSession';

const buildProfileImageSrc = (profile) => {
    return profile?.profileImageUrl || profile?.profile_image_url || '';
};

const getInitials = (firstName, lastName, username) => {
    if (firstName && lastName) {
        return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
    }
    if (username && username.length > 0) {
        return username.substring(0, 2).toUpperCase();
    }
    return '';
};

const Profile = () => {
    const navigate = useNavigate();
    const session = useSession();

    const storedProfile = session?.profile || {};
    const authSession = session?.session || session || {};
    const metadataRole = authSession?.user?.user_metadata?.role || '';
    const role = useMemo(() => (storedProfile?.role || metadataRole || '').toUpperCase(), [storedProfile?.role, metadataRole]);
    const authenticatedEmail = useMemo(() => authSession?.user?.email || storedProfile?.email || '', [authSession?.user?.email, storedProfile?.email]);
    const authenticatedUserId = useMemo(() => storedProfile?.id || null, [storedProfile?.id]);

    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        username: '',
        email: '',
        phoneNumber: '',
        profileImageUrl: '',
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    });

    // Staged image: holds the File and a local blob preview URL.
    // Nothing is uploaded to the server until "Save Changes" is clicked.
    const [stagedImage, setStagedImage] = useState(null); // { file: File, previewUrl: string }
    const stagedImageRef = useRef(null); // mirrors state for cleanup in useEffect

    const [profileId, setProfileId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const imageInputRef = useRef(null);

    // FIX: Track if profile has been loaded to prevent infinite loop
    const hasLoadedRef = useRef(false);

    const persistSessionAndForm = useCallback((profile) => {
        const latestProfile = profile || {};
        const newProfileId = latestProfile.id || authenticatedUserId;
        setProfileId(newProfileId);

        setFormData((prev) => ({
            ...prev,
            // Use != null so empty string "" from the DB is accepted (not fallen back to prev)
            firstName: latestProfile.firstName != null ? latestProfile.firstName : prev.firstName,
            lastName: latestProfile.lastName != null ? latestProfile.lastName : prev.lastName,
            username: latestProfile.username != null ? latestProfile.username : prev.username,
            email: latestProfile.email != null ? latestProfile.email : prev.email,
            phoneNumber: latestProfile.phoneNumber != null ? latestProfile.phoneNumber : prev.phoneNumber,
            profileImageUrl: latestProfile.profileImageUrl != null ? latestProfile.profileImageUrl : prev.profileImageUrl,
            currentPassword: '',
            newPassword: '',
            confirmPassword: ''
        }));

        persistProfileSession(latestProfile);
    }, [authenticatedUserId]);

    const saveProfile = useCallback(async () => {
        const effectiveEmail = (authenticatedEmail || formData.email || '').trim();
        const activeProfileId = profileId || authenticatedUserId || null;

        // Step 1: save text fields
        const profilePayload = {
            id: activeProfileId,
            email: effectiveEmail,
            username: (formData.username || '').trim(),
            firstName: formData.firstName.trim(),
            lastName: formData.lastName.trim(),
            phoneNumber: formData.phoneNumber.trim(),
            role: 'STUDENT'
        };

        console.log('[Profile] Saving profile:', profilePayload);
        const profileRes = await apiPut('/api/profile', profilePayload);
        console.log('[Profile] Save response:', profileRes.data);

        const savedProfile = profileRes.data?.profile || profileRes.data || profilePayload;
        const resolvedId = savedProfile?.id || activeProfileId;
        const resolvedEmail = savedProfile?.email || effectiveEmail;

        // Step 2: if a new picture was staged, upload it now
        let latestProfile;
        if (stagedImage?.file) {
            const uploadPayload = new FormData();
            uploadPayload.append('file', stagedImage.file);
            uploadPayload.append('userId', String(resolvedId));

            console.log('[Profile] Uploading profile picture for userId:', resolvedId);
            const uploadRes = await apiPost('/api/profile/picture', uploadPayload);
            console.log('[Profile] Upload response:', uploadRes.data);

            const uploadedProfile = uploadRes.data?.profile || uploadRes.data || {};

            latestProfile = await fetchLatestSessionProfile({
                profileId: uploadedProfile?.id || resolvedId,
                identifier: uploadedProfile?.email || resolvedEmail
            });
            console.log('[Profile] Latest profile after upload:', latestProfile);

            // Clear staged image after successful upload
            if (stagedImageRef.current?.previewUrl) {
                URL.revokeObjectURL(stagedImageRef.current.previewUrl);
            }
            stagedImageRef.current = null;
            setStagedImage(null);
        } else {
            latestProfile = await fetchLatestSessionProfile({
                profileId: resolvedId,
                identifier: resolvedEmail
            });
            console.log('[Profile] Latest profile after text update:', latestProfile);
        }

        persistSessionAndForm(latestProfile);
    }, [formData, authenticatedEmail, profileId, authenticatedUserId, persistSessionAndForm, stagedImage]);

    const updatePassword = useCallback(async () => {
        const effectiveEmail = (authenticatedEmail || formData.email || '').trim();

        if (!formData.currentPassword || !formData.newPassword) {
            throw new Error('Current password and new password are required.');
        }
        if (formData.newPassword !== formData.confirmPassword) {
            throw new Error('New passwords do not match.');
        }
        if (formData.newPassword.length < 6) {
            throw new Error('New password must be at least 6 characters.');
        }

        await apiPost('/api/auth/password', {
            email: effectiveEmail,
            currentPassword: formData.currentPassword,
            newPassword: formData.newPassword
        });

        setFormData(prev => ({ ...prev, currentPassword: '', newPassword: '', confirmPassword: '' }));
    }, [formData, authenticatedEmail]);

    // FIX: Load profile only once on mount, not on every session change
    useEffect(() => {
        if (!session) {
            navigate('/login');
            return;
        }
        if (role === 'ADMIN') {
            navigate('/admin/dashboard');
            return;
        }

        const userId = authenticatedUserId;
        if (!userId) {
            setError('Unable to load profile. Please login again.');
            setLoading(false);
            return;
        }

        // Prevent infinite loop: only load if not already loaded
        if (hasLoadedRef.current) {
            setLoading(false);
            return;
        }

        const loadProfile = async () => {
            try {
                const refreshedProfile = await fetchLatestSessionProfile({
                    profileId: userId,
                    identifier: authenticatedEmail || resolveSessionProfileIdentifier()
                });
                console.log('[Profile] Loaded profile:', refreshedProfile);
                persistSessionAndForm(refreshedProfile);
                hasLoadedRef.current = true;
            } catch (err) {
                const message = err.response?.data?.message || 'Failed to load profile.';
                setError(message);
            } finally {
                setLoading(false);
            }
        };

        loadProfile();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Empty dependency array - load once on mount

    // Revoke object URL on unmount to free memory
    useEffect(() => {
        return () => {
            if (stagedImageRef.current?.previewUrl) {
                URL.revokeObjectURL(stagedImageRef.current.previewUrl);
            }
        };
    }, []);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        if (error) setError('');
        if (success) setSuccess('');
    };

    const triggerImagePicker = () => {
        if (saving) return;
        imageInputRef.current?.click();
    };

    // Only create a local preview — no server call here
    const handleProfileImageSelect = (event) => {
        if (saving) return;

        const file = event.target.files?.[0];
        event.target.value = '';

        if (!file) return;

        const fileName = (file.name || '').toLowerCase();
        const validType = file.type === 'image/jpeg' || file.type === 'image/jpg' || file.type === 'image/png';
        const validExt = fileName.endsWith('.jpg') || fileName.endsWith('.jpeg') || fileName.endsWith('.png');

        if (!validType && !validExt) {
            setError('Only .jpg, .jpeg, and .png images are supported.');
            setSuccess('');
            return;
        }

        // Revoke previous preview to avoid memory leak
        if (stagedImageRef.current?.previewUrl) {
            URL.revokeObjectURL(stagedImageRef.current.previewUrl);
        }

        const previewUrl = URL.createObjectURL(file);
        const staged = { file, previewUrl };
        stagedImageRef.current = staged;
        setStagedImage(staged);

        setError('');
        setSuccess('');
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        setSaving(true);

        try {
            await saveProfile();

            const hasPasswordChange = formData.newPassword.trim().length > 0;
            if (hasPasswordChange) {
                await updatePassword();
            }

            setSuccess('All changes saved successfully.');
            setTimeout(() => setSuccess(''), 4000);
        } catch (err) {
            const message = err.response?.data?.message || err.message || 'Failed to save changes.';
            setError(message);
            setTimeout(() => setError(''), 5000);
        } finally {
            setSaving(false);
        }
    };

    // Show local blob preview if image was staged; otherwise show saved server URL
    const profileImageSrc = useMemo(() => {
        return stagedImage?.previewUrl || buildProfileImageSrc(formData);
    }, [stagedImage, formData]);

    const initials = useMemo(() => {
        return getInitials(formData.firstName, formData.lastName, formData.username);
    }, [formData.firstName, formData.lastName, formData.username]);

    if (loading) {
        return (
            <div className="profile-page">
                <div className="profile-card profile-loading-card" aria-busy="true" aria-live="polite">
                    <div className="profile-skeleton-header">
                        <div className="profile-skeleton-avatar" />
                        <div className="profile-skeleton-meta">
                            <div className="profile-skeleton-line profile-skeleton-line-title" />
                            <div className="profile-skeleton-line profile-skeleton-line-subtitle" />
                        </div>
                    </div>
                    <div className="profile-skeleton-grid">
                        <div className="profile-skeleton-field" />
                        <div className="profile-skeleton-field" />
                        <div className="profile-skeleton-field" />
                        <div className="profile-skeleton-field" />
                    </div>
                    <p className="profile-sync-hint">Synchronizing profile from Supabase...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="profile-page">
            <div className="profile-card">
                <div className="profile-top">
                    <div className="profile-identity-wrap">
                        <button
                            type="button"
                            className="profile-avatar-btn"
                            onClick={triggerImagePicker}
                            disabled={saving}
                            aria-label="Change profile picture"
                        >
                            {profileImageSrc ? (
                                <img
                                    key={profileImageSrc}
                                    src={profileImageSrc}
                                    alt="Profile"
                                    className="profile-avatar-img"
                                />
                            ) : (
                                <span className="profile-avatar-fallback">
                                    {initials}
                                </span>
                            )}
                            <span className="profile-avatar-overlay">
                                {stagedImage ? 'Change (unsaved)' : 'Change'}
                            </span>
                        </button>
                        <input
                            ref={imageInputRef}
                            type="file"
                            accept=".jpg,.jpeg,.png,image/png,image/jpeg"
                            onChange={handleProfileImageSelect}
                            style={{ display: 'none' }}
                        />
                        <div className="profile-identity-info">
                            <h2 className="profile-display-name">
                                {formData.firstName && formData.lastName
                                    ? `${formData.firstName} ${formData.lastName}`
                                    : formData.username || ''}
                            </h2>
                            <p className="profile-display-email">{formData.email || ''}</p>
                            <span className={`profile-role-badge ${role.toLowerCase()}`}>{role}</span>
                        </div>
                    </div>
                    {stagedImage && (
                        <p className="profile-staged-hint">
                            New photo selected — click <strong>Save Changes</strong> to apply.
                        </p>
                    )}
                    {error && <div className="error-msg">{error}</div>}
                    {success && <div className="success-msg">{success}</div>}
                </div>

                <form className="profile-form" onSubmit={handleSave}>
                    <div className="profile-form-grid">
                        <div className="profile-form-field">
                            <label htmlFor="firstName">First Name</label>
                            <input
                                id="firstName"
                                className="ui-input"
                                name="firstName"
                                type="text"
                                value={formData.firstName}
                                onChange={handleChange}
                                disabled={saving}
                                autoComplete="given-name"
                            />
                        </div>
                        <div className="profile-form-field">
                            <label htmlFor="lastName">Last Name</label>
                            <input
                                id="lastName"
                                className="ui-input"
                                name="lastName"
                                type="text"
                                value={formData.lastName}
                                onChange={handleChange}
                                disabled={saving}
                                autoComplete="family-name"
                            />
                        </div>
                        <div className="profile-form-field">
                            <label htmlFor="username">Username</label>
                            <input
                                id="username"
                                className="ui-input"
                                name="username"
                                type="text"
                                value={formData.username}
                                onChange={handleChange}
                                disabled
                            />
                        </div>
                        <div className="profile-form-field">
                            <label htmlFor="email">Email</label>
                            <input
                                id="email"
                                className="ui-input"
                                name="email"
                                type="email"
                                value={formData.email}
                                onChange={handleChange}
                                disabled
                            />
                        </div>
                        <div className="profile-form-field">
                            <label htmlFor="phoneNumber">Phone Number</label>
                            <input
                                id="phoneNumber"
                                className="ui-input"
                                name="phoneNumber"
                                type="tel"
                                value={formData.phoneNumber}
                                onChange={handleChange}
                                disabled={saving}
                                autoComplete="tel"
                            />
                        </div>
                    </div>

                    <div className="profile-password-divider">
                        <h3 className="ui-section-title">Change Password</h3>
                        <div className="profile-form-grid">
                            <div className="profile-form-field">
                                <label htmlFor="currentPassword">Current Password</label>
                                <input
                                    id="currentPassword"
                                    className="ui-input"
                                    name="currentPassword"
                                    type="password"
                                    value={formData.currentPassword}
                                    onChange={handleChange}
                                    disabled={saving}
                                    placeholder="Current password"
                                    autoComplete="current-password"
                                />
                            </div>
                            <div className="profile-form-field">
                                <label htmlFor="newPassword">New Password</label>
                                <input
                                    id="newPassword"
                                    className="ui-input"
                                    name="newPassword"
                                    type="password"
                                    value={formData.newPassword}
                                    onChange={handleChange}
                                    disabled={saving}
                                    placeholder="New password"
                                    autoComplete="new-password"
                                />
                            </div>
                            <div className="profile-form-field">
                                <label htmlFor="confirmPassword">Confirm New Password</label>
                                <input
                                    id="confirmPassword"
                                    className="ui-input"
                                    name="confirmPassword"
                                    type="password"
                                    value={formData.confirmPassword}
                                    onChange={handleChange}
                                    disabled={saving}
                                    placeholder="Confirm new password"
                                    autoComplete="new-password"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="profile-top-actions">
                        <button
                            type="submit"
                            className="profile-save-btn ui-button ui-button--primary"
                            disabled={saving}
                        >
                            {saving ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default Profile;