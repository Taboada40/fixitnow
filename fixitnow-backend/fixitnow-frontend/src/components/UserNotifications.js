import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const POLL_INTERVAL_MS = 8000;

const getErrorMessage = (err, fallback) => {
    let raw = err?.response?.data;
    if (typeof raw === 'string') {
        try {
            raw = JSON.parse(raw);
        } catch (_) {
            return raw || fallback;
        }
    }
    if (raw && typeof raw === 'object') {
        return raw.message || raw.error_description || raw.error || fallback;
    }
    return fallback;
};

const UserNotifications = () => {
    const navigate = useNavigate();
    const storedSession = useMemo(() => JSON.parse(localStorage.getItem('session') || 'null'), []);
    const authSession = storedSession?.session || storedSession;
    const userId = storedSession?.profile?.id || null;
    const email = storedSession?.profile?.email || authSession?.user?.email;
    const role = (storedSession?.profile?.role || 'STUDENT').toUpperCase();

    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!storedSession) {
            navigate('/login');
            return;
        }
        if (role === 'ADMIN') {
            navigate('/admin/notifications');
            return;
        }

        const loadNotifications = async () => {
            if (!userId && !email) {
                setError('Unable to load notifications. Please login again.');
                setLoading(false);
                return;
            }

            try {
                const params = new URLSearchParams();
                if (userId) {
                    params.set('userId', String(userId));
                }
                if (email) {
                    params.set('email', email);
                }

                const res = await axios.get(`http://localhost:8080/api/notifications?${params.toString()}`, {
                    withCredentials: true
                });
                setNotifications(Array.isArray(res.data) ? res.data : []);
                setError('');
            } catch (err) {
                const message = getErrorMessage(err, 'Failed to load notifications.');
                setError(message);
            } finally {
                setLoading(false);
            }
        };

        loadNotifications();

        const intervalId = setInterval(loadNotifications, POLL_INTERVAL_MS);
        const onFocus = () => loadNotifications();
        window.addEventListener('focus', onFocus);

        return () => {
            clearInterval(intervalId);
            window.removeEventListener('focus', onFocus);
        };
    }, [storedSession, role, userId, email, navigate]);

    const handleLogout = () => {
        localStorage.removeItem('session');
        navigate('/login');
    };

    return (
        <div className="profile-page">
            <div className="profile-card">
                <div className="profile-top">
                    <div>
                        <h2>Notifications</h2>
                        <p>Updates when admin reviews your reports</p>
                    </div>
                    <div className="profile-top-actions">
                        <button className="profile-nav-btn" onClick={() => navigate('/dashboard')}>Dashboard</button>
                        <button className="profile-nav-btn" onClick={() => navigate('/reports')}>Report History</button>
                        <button className="profile-nav-btn danger" onClick={handleLogout}>Logout</button>
                    </div>
                </div>

                {error && <div className="error-msg">{error}</div>}

                {loading ? (
                    <div className="reports-loading">Loading notifications...</div>
                ) : notifications.length === 0 ? (
                    <div className="reports-empty">No notifications yet.</div>
                ) : (
                    <div className="reports-list">
                        {notifications.map((item) => (
                            <div key={item.id} className="reports-row">
                                <div className="reports-row-main">
                                    <div className="reports-title">{item.title}</div>
                                    <div className="reports-meta">{item.message} | {new Date(item.createdAt).toLocaleString()}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default UserNotifications;
