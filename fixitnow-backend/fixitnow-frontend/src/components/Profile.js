import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const API_BASE = 'http://localhost:8080';

const buildProfileImageSrc = (profile) => {
    if (!profile?.profileImage) {
        return '';
    }

    const contentType = profile.profileImageContentType || 'image/jpeg';
    return `data:${contentType};base64,${profile.profileImage}`;
};

const getInitials = (firstName, lastName, username) => {
    const first = (firstName || '').trim();
    const last = (lastName || '').trim();
    if (first || last) {
        return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase() || 'U';
    }

    const user = (username || '').trim();
    return user ? user.charAt(0).toUpperCase() : 'U';
};

const buildFileReferenceFromProfile = (profile) => {
    if (!profile) {
        return '';
    }

    const identity = profile.id || profile.email;
    const fileName = profile.profileImageName || 'image';
    if (!identity || !profile.profileImage) {
        return '';
    }

    return `profile-picture:${identity}:${fileName}`;
};

const mergeSessionProfile = (sessionSnapshot, profile) => {
    const snapshot = sessionSnapshot || {};
    const mergedProfile = {
        ...(snapshot.profile || {}),
        ...(profile || {})
    };

    return {
        ...snapshot,
        profile: mergedProfile,
        session: snapshot.session
            ? {
                ...snapshot.session,
                user: snapshot.session.user
                    ? {
                        ...snapshot.session.user,
                        user_metadata: {
                            ...(snapshot.session.user.user_metadata || {}),
                            first_name: mergedProfile.firstName || '',
                            last_name: mergedProfile.lastName || '',
                            username: mergedProfile.username || '',
                            phone_number: mergedProfile.phoneNumber || ''
                        }
                    }
                    : snapshot.session.user
            }
            : snapshot.session
    };
};

const Profile = () => {
    const navigate = useNavigate();
    const storedSession = useMemo(() => JSON.parse(localStorage.getItem('session') || 'null'), []);
    const authSession = storedSession?.session || storedSession;
    const role = (storedSession?.profile?.role || 'STUDENT').toUpperCase();
    const authenticatedEmail = authSession?.user?.email || storedSession?.profile?.email || '';
    const authenticatedUserId = storedSession?.profile?.id || null;

    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        username: '',
        email: '',
        phoneNumber: '',
        profileImage: '',
        profileImageName: '',
        profileImageContentType: ''
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [profileId, setProfileId] = useState(authenticatedUserId);
    const [uploadingImage, setUploadingImage] = useState(false);
    const [fileReference, setFileReference] = useState('');
    const [changingPassword, setChangingPassword] = useState(false);
    const [passwordForm, setPasswordForm] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    });
    const imageInputRef = useRef(null);

    const persistSessionAndForm = useCallback((profile) => {
        const latestProfile = profile || {};
        setProfileId(latestProfile.id || profileId || authenticatedUserId || null);
        setFormData({
            firstName: latestProfile.firstName || '',
            lastName: latestProfile.lastName || '',
            username: latestProfile.username || '',
            email: latestProfile.email || authenticatedEmail,
            phoneNumber: latestProfile.phoneNumber || '',
            profileImage: latestProfile.profileImage || '',
            profileImageName: latestProfile.profileImageName || '',
            profileImageContentType: latestProfile.profileImageContentType || ''
        });
        setFileReference(buildFileReferenceFromProfile(latestProfile));

        const latestSession = JSON.parse(localStorage.getItem('session') || 'null');
        const updatedSession = mergeSessionProfile(latestSession, latestProfile);
        localStorage.setItem('session', JSON.stringify(updatedSession));
    }, [profileId, authenticatedUserId, authenticatedEmail]);

    const fetchCanonicalProfile = useCallback(async (profileHint = null) => {
        const hintId = profileHint?.id || profileId || authenticatedUserId;
        const hintEmail = (profileHint?.email || formData.email || authenticatedEmail || '').trim();

        if (hintId) {
            const byId = await axios.get(
                `${API_BASE}/api/profile/by-id?userId=${encodeURIComponent(hintId)}&_ts=${Date.now()}`,
                { withCredentials: true }
            );
            return byId.data || profileHint;
        }

        if (hintEmail) {
            const byIdentifier = await axios.get(
                `${API_BASE}/api/profile/authenticated?identifier=${encodeURIComponent(hintEmail)}&_ts=${Date.now()}`,
                { withCredentials: true }
            );
            return byIdentifier.data || profileHint;
        }

        return profileHint;
    }, [profileId, authenticatedUserId, formData.email, authenticatedEmail]);

    const saveProfile = useCallback(async () => {
        const effectiveEmail = (formData.email || authenticatedEmail || '').trim();
        const payload = {
            id: profileId || authenticatedUserId || null,
            email: effectiveEmail,
            firstName: formData.firstName,
            lastName: formData.lastName,
            username: formData.username,
            phoneNumber: formData.phoneNumber
        };

        if (!payload.id && !payload.email) {
            setError('Unable to update profile. Please log in again.');
            return;
        }

        setSaving(true);

        try {
            const res = await axios.put(`${API_BASE}/api/profile`, payload, {
                withCredentials: true
            });

            const persistedProfile = res.data || {};
            const canonicalProfile = await fetchCanonicalProfile(persistedProfile);
            persistSessionAndForm(canonicalProfile || persistedProfile);

            setSuccess('Profile updated successfully.');
        } catch (err) {
            const message = err.response?.data?.message || 'Failed to update profile.';
            setError(message);
        } finally {
            setSaving(false);
        }
    }, [profileId, authenticatedUserId, authenticatedEmail, formData, persistSessionAndForm, fetchCanonicalProfile]);

    const handleLogout = () => {
        localStorage.removeItem('session');
        navigate('/login');
    };

    const triggerImagePicker = () => {
        if (uploadingImage || saving) {
            return;
        }
        imageInputRef.current?.click();
    };

    const handleProfileImageUpload = async (event) => {
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

        const effectiveEmail = (formData.email || authenticatedEmail || '').trim();

        if (!(profileId || authenticatedUserId) && !effectiveEmail) {
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
            if (profileId || authenticatedUserId) {
                uploadPayload.append('userId', String(profileId || authenticatedUserId));
            }
            uploadPayload.append('email', effectiveEmail);

            const uploadRes = await axios.post(`${API_BASE}/api/profile/picture`, uploadPayload, {
                withCredentials: true,
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });

            const uploadedProfile = uploadRes.data?.profile || {};
            const reference = uploadRes.data?.fileReference || '';

            const canonicalProfile = await fetchCanonicalProfile(uploadedProfile);
            persistSessionAndForm(canonicalProfile || uploadedProfile);

            setFileReference(reference);
            setSuccess(uploadRes.data?.message || 'Profile picture uploaded successfully.');
        } catch (err) {
            const message = err.response?.data?.message || 'Failed to upload profile picture.';
            setError(message);
        } finally {
            setUploadingImage(false);
        }
    };

    useEffect(() => {
        if (!storedSession) {
            navigate('/login');
            return;
        }
        if (role === 'ADMIN') {
            navigate('/admin/dashboard');
            return;
        }

        const email = authenticatedEmail;
        const userId = authenticatedUserId;
        if (!email && !userId) {
            setError('Unable to load profile. Please login again.');
            setLoading(false);
            return;
        }

        const loadProfile = async () => {
            try {
                const res = userId
                    ? await axios.get(`${API_BASE}/api/profile/by-id?userId=${encodeURIComponent(userId)}`, {
                        withCredentials: true
                    })
                    : await axios.get(`${API_BASE}/api/profile/authenticated?identifier=${encodeURIComponent(email)}`, {
                        withCredentials: true
                    });

                const refreshedProfile = res.data || {};
                persistSessionAndForm(refreshedProfile);
            } catch (err) {
                const message = err.response?.data?.message || 'Failed to load profile.';
                setError(message);
                const userMeta = authSession?.user?.user_metadata || {};
                const fallbackProfile = {
                    firstName: userMeta.first_name || '',
                    lastName: userMeta.last_name || '',
                    username: userMeta.username || '',
                    email,
                    phoneNumber: userMeta.phone_number || '',
                    profileImage: '',
                    profileImageName: '',
                    profileImageContentType: ''
                };
                setFormData(fallbackProfile);
            } finally {
                setLoading(false);
            }
        };

        loadProfile();
    }, [storedSession, authSession, navigate, role, authenticatedEmail, authenticatedUserId, persistSessionAndForm]);

    const handleSave = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        await saveProfile();
    };

    const handlePasswordChange = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
            setError('Please complete all password fields.');
            return;
        }

        if (passwordForm.newPassword.length < 6) {
            setError('New password must be at least 6 characters.');
            return;
        }

        if (passwordForm.newPassword !== passwordForm.confirmPassword) {
            setError('New password and confirmation do not match.');
            return;
        }

        setChangingPassword(true);
        try {
            const res = await axios.put(`${API_BASE}/api/auth/password`, {
                email: authenticatedEmail,
                currentPassword: passwordForm.currentPassword,
                newPassword: passwordForm.newPassword
            }, {
                withCredentials: true
            });

            setSuccess(res.data?.message || 'Password updated successfully.');
            setPasswordForm({
                currentPassword: '',
                newPassword: '',
                confirmPassword: ''
            });
        } catch (err) {
            let message = err.response?.data?.message || 'Failed to update password.';
            if (typeof err.response?.data === 'string') {
                try {
                    const parsed = JSON.parse(err.response.data);
                    message = parsed?.error_description || parsed?.message || message;
                } catch (_) {
                    message = err.response.data || message;
                }
            }
            setError(message);
        } finally {
            setChangingPassword(false);
        }
    };

    if (loading) {
        return (
            <div className="profile-page">
                <div className="profile-card">Loading profile...</div>
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
                            {buildProfileImageSrc(formData) ? (
                                <img
                                    src={buildProfileImageSrc(formData)}
                                    alt="Profile"
                                    className="profile-avatar-img"
                                />
                            ) : (
                                <span className="profile-avatar-fallback">
                                    {getInitials(formData.firstName, formData.lastName, formData.username)}
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
                            className="profile-avatar-input"
                        />
                        <div>
                            <h2>Profile Information</h2>
                            <p>Manage your personal details</p>
                            <p className="profile-avatar-hint">Click your profile picture to change it (.jpg, .png)</p>
                            {fileReference && <p className="profile-avatar-ref">File ref: {fileReference}</p>}
                        </div>
                    </div>
                    <div className="profile-top-actions">
                        <button className="profile-nav-btn" onClick={() => navigate('/dashboard')}>Dashboard</button>
                        <button className="profile-nav-btn" onClick={() => navigate('/reports')}>Report History</button>
                        <button className="profile-nav-btn danger" onClick={handleLogout}>Logout</button>
                    </div>
                </div>

                {error && <div className="error-msg">{error}</div>}
                {success && <div className="success-msg">{success}</div>}
                <form onSubmit={handleSave}>
                    <div className="form-row">
                        <div className="form-group">
                            <label>First Name</label>
                            <input
                                type="text"
                                required
                                value={formData.firstName}
                                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                            />
                        </div>
                        <div className="form-group">
                            <label>Last Name</label>
                            <input
                                type="text"
                                required
                                value={formData.lastName}
                                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label>Email</label>
                            <input type="email" value={authenticatedEmail || formData.email} readOnly />
                        </div>
                        <div className="form-group">
                            <label>Username</label>
                            <input
                                type="text"
                                required
                                value={formData.username}
                                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Phone Number</label>
                        <input
                            type="text"
                            value={formData.phoneNumber}
                            onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                        />
                    </div>

                    <button className="btn-builder" type="submit" disabled={saving}>
                        {saving ? 'Updating...' : 'Update Profile'}
                    </button>
                </form>

                <div className="profile-password-panel">
                    <h3>Change Password</h3>
                    <p>Use your current password to set a new one.</p>

                    <form onSubmit={handlePasswordChange}>
                        <div className="form-row">
                            <div className="form-group">
                                <label>Current Password</label>
                                <input
                                    type="password"
                                    required
                                    value={passwordForm.currentPassword}
                                    onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label>New Password</label>
                                <input
                                    type="password"
                                    required
                                    value={passwordForm.newPassword}
                                    onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label>Confirm New Password</label>
                            <input
                                type="password"
                                required
                                value={passwordForm.confirmPassword}
                                onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                            />
                        </div>

                        <button className="btn-builder" type="submit" disabled={changingPassword}>
                            {changingPassword ? 'Updating Password...' : 'Update Password'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default Profile;
