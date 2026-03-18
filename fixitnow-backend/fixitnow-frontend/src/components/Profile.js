import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const API_BASE = 'http://localhost:8080';

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
        phoneNumber: ''
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [autoSaving, setAutoSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loadedProfile, setLoadedProfile] = useState(null);
    const [profileId, setProfileId] = useState(authenticatedUserId);
    const skipNextAutosaveRef = useRef(true);
    const autosaveTimerRef = useRef(null);

    const persistSessionAndForm = useCallback((profile) => {
        const latestProfile = profile || {};
        setProfileId(latestProfile.id || profileId || authenticatedUserId || null);
        setLoadedProfile({
            firstName: latestProfile.firstName || '',
            lastName: latestProfile.lastName || '',
            username: latestProfile.username || '',
            email: latestProfile.email || authenticatedEmail,
            phoneNumber: latestProfile.phoneNumber || ''
        });
        setFormData({
            firstName: latestProfile.firstName || '',
            lastName: latestProfile.lastName || '',
            username: latestProfile.username || '',
            email: latestProfile.email || authenticatedEmail,
            phoneNumber: latestProfile.phoneNumber || ''
        });

        const latestSession = JSON.parse(localStorage.getItem('session') || 'null');
        const updatedSession = mergeSessionProfile(latestSession, latestProfile);
        localStorage.setItem('session', JSON.stringify(updatedSession));
    }, [profileId, authenticatedUserId, authenticatedEmail]);

    const saveProfile = useCallback(async (manual = false) => {
        const payload = {
            id: profileId || authenticatedUserId || null,
            email: authenticatedEmail,
            firstName: formData.firstName,
            lastName: formData.lastName,
            username: formData.username,
            phoneNumber: formData.phoneNumber
        };

        if (manual) {
            setSaving(true);
        } else {
            setAutoSaving(true);
        }

        try {
            const res = await axios.put(`${API_BASE}/api/profile`, payload, {
                withCredentials: true
            });

            const persistedProfile = res.data || {};
            if (persistedProfile?.id) {
                const verifyRes = await axios.get(
                    `${API_BASE}/api/profile/by-id?userId=${encodeURIComponent(persistedProfile.id)}&_ts=${Date.now()}`,
                    { withCredentials: true }
                );
                persistSessionAndForm(verifyRes.data || persistedProfile);
            } else {
                persistSessionAndForm(persistedProfile);
            }

            setSuccess(manual ? 'Profile updated successfully.' : 'Profile saved automatically.');
        } catch (err) {
            const message = err.response?.data?.message || 'Failed to update profile.';
            setError(message);
        } finally {
            if (manual) {
                setSaving(false);
            } else {
                setAutoSaving(false);
            }
        }
    }, [profileId, authenticatedUserId, authenticatedEmail, formData, persistSessionAndForm]);

    const handleLogout = () => {
        localStorage.removeItem('session');
        navigate('/login');
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
                    : await axios.get(`${API_BASE}/api/profile?email=${encodeURIComponent(email)}`, {
                        withCredentials: true
                    });

                const refreshedProfile = res.data || {};
                skipNextAutosaveRef.current = true;
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
                    phoneNumber: userMeta.phone_number || ''
                };
                skipNextAutosaveRef.current = true;
                setLoadedProfile(fallbackProfile);
                setFormData(fallbackProfile);
            } finally {
                setLoading(false);
            }
        };

        loadProfile();
    }, [storedSession, authSession, navigate, role, authenticatedEmail, authenticatedUserId, persistSessionAndForm]);

    useEffect(() => {
        if (loading || !loadedProfile) {
            return;
        }

        const current = JSON.stringify({
            firstName: formData.firstName,
            lastName: formData.lastName,
            username: formData.username,
            phoneNumber: formData.phoneNumber
        });
        const baseline = JSON.stringify({
            firstName: loadedProfile.firstName,
            lastName: loadedProfile.lastName,
            username: loadedProfile.username,
            phoneNumber: loadedProfile.phoneNumber
        });

        if (current === baseline) {
            return;
        }

        if (skipNextAutosaveRef.current) {
            skipNextAutosaveRef.current = false;
            return;
        }

        if (autosaveTimerRef.current) {
            clearTimeout(autosaveTimerRef.current);
        }
        autosaveTimerRef.current = setTimeout(() => {
            setError('');
            setSuccess('');
            saveProfile(false);
        }, 700);

        return () => {
            if (autosaveTimerRef.current) {
                clearTimeout(autosaveTimerRef.current);
            }
        };
    }, [formData, loadedProfile, loading, saveProfile]);

    useEffect(() => {
        return () => {
            if (autosaveTimerRef.current) {
                clearTimeout(autosaveTimerRef.current);
            }
        };
    }, []);

    const handleSave = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        await saveProfile(true);
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
                    <div>
                        <h2>Profile Information</h2>
                        <p>Manage your personal details</p>
                    </div>
                    <div className="profile-top-actions">
                        <button className="profile-nav-btn" onClick={() => navigate('/dashboard')}>Dashboard</button>
                        <button className="profile-nav-btn" onClick={() => navigate('/reports')}>Report History</button>
                        <button className="profile-nav-btn danger" onClick={handleLogout}>Logout</button>
                    </div>
                </div>

                {error && <div className="error-msg">{error}</div>}
                {success && <div className="success-msg">{success}</div>}
                {autoSaving && <div className="success-msg">Saving changes...</div>}

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
            </div>
        </div>
    );
};

export default Profile;
