import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { getErrorMessage } from '../utils/constants';
import { apiPost, fetchLatestSessionProfile, setSession } from '../utils/profileSession';

const Login = () => {
    const [creds, setCreds] = useState({ email: '', password: '' });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');

        const identifier = (creds.email || '').trim().toLowerCase();
        if (!identifier) { setError('Please enter your email.'); return; }
        if (creds.password.length < 6) { setError('Password must be at least 6 characters.'); return; }

        setLoading(true);
        try {
            const loginRes = await apiPost('/api/auth/login', {
                ...creds,
                email: identifier
            }, { auth: false });

            const sessionPayload = loginRes?.data || {};
            const sessionDetails = sessionPayload?.session || {};
            const accessToken = sessionPayload?.accessToken
                || sessionDetails?.access_token
                || sessionDetails?.accessToken
                || sessionPayload?.access_token
                || '';

            if (!accessToken) throw new Error('Login succeeded but no access token was returned.');

            const loginProfile = loginRes?.data?.profile || {};
            const sessionSnapshot = {
                ...sessionPayload,
                accessToken,
                session: {
                    ...sessionDetails,
                    access_token: accessToken,
                    token_type: sessionDetails?.token_type || sessionPayload?.tokenType || 'bearer'
                }
            };

            let latestProfile = loginProfile;
            try {
                const fetchedProfile = await fetchLatestSessionProfile({
                    profileId: loginProfile?.id,
                    identifier: loginProfile?.email || loginRes?.data?.session?.user?.email || identifier,
                    sessionSnapshot
                });
                if (fetchedProfile?.email || fetchedProfile?.id) {
                    latestProfile = fetchedProfile;
                }
            } catch (profileError) {
                if (!latestProfile?.email && !latestProfile?.id) {
                    latestProfile = {
                        email: loginRes?.data?.session?.user?.email || identifier,
                        username: loginRes?.data?.profile?.username || identifier.split('@')[0] || '',
                        firstName: loginRes?.data?.profile?.firstName || '',
                        lastName: loginRes?.data?.profile?.lastName || '',
                        role: loginRes?.data?.profile?.role || loginRes?.data?.session?.user?.user_metadata?.role || 'STUDENT'
                    };
                }
            }

            const existingUser = loginRes.data?.session?.user || {};
            const resolvedUserId = latestProfile?.id || existingUser?.id || loginRes?.data?.session?.user?.id || null;
            const existingMetadata = existingUser?.user_metadata || {};

            const nextUserMetadata = { ...existingMetadata };
            if (latestProfile.firstName != null) nextUserMetadata.first_name = latestProfile.firstName;
            if (latestProfile.lastName != null) nextUserMetadata.last_name = latestProfile.lastName;
            if (latestProfile.username != null) nextUserMetadata.username = latestProfile.username;
            if (latestProfile.phoneNumber != null) nextUserMetadata.phone_number = latestProfile.phoneNumber;
            if (latestProfile.role != null) nextUserMetadata.role = String(latestProfile.role).toUpperCase();
            if (latestProfile.profileImageUrl != null) nextUserMetadata.profile_image_url = latestProfile.profileImageUrl;

            setSession({
                ...sessionSnapshot,
                profile: {
                    ...latestProfile,
                    id: resolvedUserId
                },
                session: {
                    ...(sessionSnapshot.session || {}),
                    user: {
                        ...existingUser,
                        email: latestProfile.email || existingUser?.email || identifier,
                        user_metadata: nextUserMetadata
                    }
                }
            });

            const role = (latestProfile.role || loginProfile.role || '').toUpperCase();
            navigate(role === 'ADMIN' ? '/admin/dashboard' : '/dashboard');

        } catch (err) {
            console.error('Login Error:', err);
            if (!err.response) {
                setError('Cannot reach server. Please check your internet connection and ensure the backend is running.');
                return;
            }
            const baseMessage = getErrorMessage(err, 'Login failed. Please try again.');
            const low = baseMessage.toLowerCase();
            if (low.includes('email not confirmed')) {
                setError('Please verify your email first, then try logging in again.');
            } else if (low.includes('invalid login credentials') || low.includes('invalid')) {
                setError('Incorrect email or password. Please try again.');
            } else {
                setError(baseMessage);
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-page">
            <div className="auth-card">
                <div className="auth-header">
                    <span className="brand-title">FixItNow</span>
                    <h2>Login</h2>
                </div>
                <div className="auth-body">
                    {error && <div className="error-msg">{error}</div>}
                    <form onSubmit={handleLogin}>
                        <div className="form-group">
                            <label>Email</label>
                            <input
                                className="ui-input"
                                type="text"
                                required
                                value={creds.email}
                                onChange={e => setCreds({...creds, email: e.target.value})}
                            />
                        </div>
                        <div className="form-group">
                            <label>Password</label>
                            <input
                                className="ui-input"
                                type="password"
                                required
                                value={creds.password}
                                onChange={e => setCreds({...creds, password: e.target.value})}
                            />
                        </div>
                        <div className="forgot-password">
                            <span>Forgot password?</span>
                        </div>
                        <button type="submit" className="ui-button ui-button--primary ui-button--block" disabled={loading}>
                            {loading ? 'Logging in...' : 'Log in'}
                        </button>
                    </form>
                    <div className="auth-footer">
                        Don't have an account? <Link to="/register" className="auth-link">Sign up</Link>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Login;