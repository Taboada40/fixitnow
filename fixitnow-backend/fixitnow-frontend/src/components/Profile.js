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
    // Use only profileImageUrl as the single source of truth
    return profile?.profileImageUrl || '';
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

    const [profileId, setProfileId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [uploadingImage, setUploadingImage] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const imageInputRef = useRef(null);

    const persistSessionAndForm = useCallback((profile) => {
        const latestProfile = profile || {};
        const newProfileId = latestProfile.id || authenticatedUserId;
        setProfileId(newProfileId);

        setFormData((prev) => ({
            ...prev,
            firstName: latestProfile.firstName ?? prev.firstName,
            lastName: latestProfile.lastName ?? prev.lastName,
            username: latestProfile.username ?? prev.username,
            email: latestProfile.email ?? prev.email,
            phoneNumber: latestProfile.phoneNumber ?? prev.phoneNumber,
            profileImageUrl: latestProfile.profileImageUrl ?? prev.profileImageUrl,
            currentPassword: '',
            newPassword: '',
            confirmPassword: ''
        }));

        persistProfileSession(latestProfile);
    }, [authenticatedUserId]);

    const saveProfile = useCallback(async () => {
        const effectiveEmail = (authenticatedEmail || formData.email || '').trim();
        const profilePayload = {
            id: profileId || authenticatedUserId || null,
            email: effectiveEmail,
            username: (formData.username || '').trim(),
            firstName: formData.firstName.trim(),
            lastName: formData.lastName.trim(),
            phoneNumber: formData.phoneNumber.trim(),
            role: 'STUDENT'
        };

        const profileRes = await apiPut('/api/profile', profilePayload);
        const savedProfile = profileRes.data?.profile || profileRes.data || profilePayload;
        const latestProfile = await fetchLatestSessionProfile({
            profileId: savedProfile?.id || profilePayload.id,
            identifier: savedProfile?.email || effectiveEmail
        });
        persistSessionAndForm(latestProfile);
    }, [formData, authenticatedEmail, profileId, authenticatedUserId, persistSessionAndForm]);

    const updatePassword = useCallback(async () => {
        const passwordPayload = {
            currentPassword: formData.currentPassword,
            newPassword: formData.newPassword
        };

        await apiPost('/api/auth/password', passwordPayload);
        setFormData(prev => ({ ...prev, currentPassword: '', newPassword: '', confirmPassword: '' }));
    }, [formData]);

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

        const loadProfile = async () => {
            try {
                const refreshedProfile = await fetchLatestSessionProfile({
                    profileId: userId,
                    identifier: authenticatedEmail || resolveSessionProfileIdentifier()
                });
                persistSessionAndForm(refreshedProfile);
            } catch (err) {
                const message = err.response?.data?.message || 'Failed to load profile.';
                setError(message);
            } finally {
                setLoading(false);
            }
        };

        loadProfile();
    }, [session, navigate, role, authenticatedUserId, authenticatedEmail, persistSessionAndForm]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        if (error) setError('');
        if (success) setSuccess('');
    };

    const triggerImagePicker = () => {
        if (uploadingImage || saving) {
            return;
        }
        imageInputRef.current?.click();
    };

    const handleProfileImageUpload = async (event) => {
        if (uploadingImage || saving) {
            return;
        }
        
        const file = event.target.files?.[0];
        event.target.value = '';

        if (!file) {
            return;
        }

        const fileName = (file.name || '').toLowerCase();
        const validType = file.type === 'image/jpeg' || file.type === 'image/jpg' || file.type === 'image/png';
        const validExt = fileName.endsWith('.jpg') || fileName.endsWith('.jpeg') || fileName.endsWith('.png');

        if (!validType && !validExt) {
            setError('Only .jpg, .jpeg, and .png images are supported.');
            setSuccess('');
            return;
        }

        const activeProfileId = profileId || authenticatedUserId || null;
        if (!activeProfileId) {
            setError('Unable to upload picture. Please log in again.');
            setSuccess('');
            return;
        }

        setUploadingImage(true);
        setError('');
        setSuccess('');

        try {
            const uploadPayload = new FormData();
            uploadPayload.append('file', file);
            uploadPayload.append('userId', String(activeProfileId));

            const uploadRes = await apiPost('/api/profile/picture', uploadPayload);

            const uploadedProfile = uploadRes.data?.profile || uploadRes.data || {};
            const latestProfile = await fetchLatestSessionProfile({
                profileId: uploadedProfile?.id || activeProfileId,
                identifier: uploadedProfile?.email || authenticatedEmail || formData.email
            });
            persistSessionAndForm(latestProfile);
            setSuccess(uploadRes.data?.message || 'Profile picture uploaded successfully.');
            setTimeout(() => setSuccess(''), 4000);
        } catch (err) {
            const message = err.response?.data?.message || 'Failed to upload profile picture.';
            setError(message);
            setTimeout(() => setError(''), 5000);
        } finally {
            setUploadingImage(false);
        }
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
            const message = err.message || 'Failed to save changes.';
            setError(message);
            setTimeout(() => setError(''), 5000);
        } finally {
            setSaving(false);
        }
    };

    const profileImageSrc = useMemo(() => {
        return buildProfileImageSrc(formData);
    }, [formData]);
    
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
                            disabled={uploadingImage || saving}
                            aria-label="Change profile picture"
                        >
                            {profileImageSrc ? (
                                <img
                                    key={formData.profileImageUrl}
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
                                {uploadingImage ? 'Uploading...' : 'Change'}
                            </span>
                        </button>
                        <input
                            ref={imageInputRef}
                            type="file"
                            accept=".jpg,.jpeg,.png,image/png,image/jpeg"
                            onChange={handleProfileImageUpload}
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
                                />
                            </div>
                        </div>
                    </div>

                    <div className="profile-top-actions">
                        <button
                            type="submit"
                            className="profile-save-btn ui-button ui-button--primary"
                            disabled={saving || uploadingImage}
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
