import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const DEFAULT_ADMIN_EMAIL = 'admin@cit.edu';

const AdminNotifications = () => {
    const navigate = useNavigate();
    const storedSession = useMemo(() => JSON.parse(localStorage.getItem('session') || 'null'), []);
    const role = (storedSession?.profile?.role || 'STUDENT').toUpperCase();
    const adminEmail = storedSession?.profile?.email || storedSession?.session?.user?.email || DEFAULT_ADMIN_EMAIL;

    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!storedSession) {
            navigate('/login');
            return;
        }
        if (role !== 'ADMIN') {
            navigate('/dashboard');
            return;
        }

        const loadNotifications = async () => {
            try {
                const res = await axios.get(`http://localhost:8080/api/admin/notifications?adminEmail=${encodeURIComponent(adminEmail || '')}`, {
                    withCredentials: true
                });
                setNotifications(Array.isArray(res.data) ? res.data : []);
            } catch (err) {
                const message = err.response?.data?.message || 'Failed to load admin notifications.';
                setError(message);
            } finally {
                setLoading(false);
            }
        };

        loadNotifications();
    }, [storedSession, role, adminEmail, navigate]);

    const handleLogout = () => {
        localStorage.removeItem('session');
        navigate('/login');
    };

    return (
        <div className="profile-page">
            <div className="profile-card">
                <div className="profile-top">
                    <div>
                        <h2>Admin Notifications</h2>
                        <p>New reports submitted by users</p>
                    </div>
                    <div className="profile-top-actions">
                        <button className="profile-nav-btn" onClick={() => navigate('/admin/dashboard')}>Admin Dashboard</button>
                        <button className="profile-nav-btn danger" onClick={handleLogout}>Logout</button>
                    </div>
                </div>

                {error && <div className="error-msg">{error}</div>}

                {loading ? (
                    <div className="reports-loading">Loading notifications...</div>
                ) : notifications.length === 0 ? (
                    <div className="reports-empty">No admin notifications yet.</div>
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

export default AdminNotifications;
