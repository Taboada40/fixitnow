import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getErrorMessage } from '../utils/constants';
import { apiGet, useSession } from '../utils/profileSession';

const AdminNotifications = () => {
    const navigate = useNavigate();
    const session = useSession();
    const profile = session?.profile || {};
    const role = (profile?.role || 'STUDENT').toUpperCase();
    const adminUserId = profile?.id || null;
    const adminEmail = profile?.email || session?.session?.user?.email || '';
    const adminAccessParams = useMemo(
        () => (adminUserId ? { adminUserId } : { adminEmail }),
        [adminUserId, adminEmail]
    );

    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!session) {
            navigate('/login');
            return;
        }
        if (role !== 'ADMIN') {
            navigate('/dashboard');
            return;
        }

        const loadNotifications = async () => {
            try {
                const res = await apiGet('/api/admin/notifications', { params: adminAccessParams });
                setNotifications(Array.isArray(res.data) ? res.data : []);
            } catch (err) {
                const message = getErrorMessage(err, 'Failed to load admin notifications.');
                setError(message);
            } finally {
                setLoading(false);
            }
        };

        loadNotifications();
    }, [session, role, adminAccessParams, navigate]);

    return (
        <div className="profile-page">
            <div className="profile-card">
                <div className="profile-top">
                    <div>
                        <h2 className="ui-page-title">Admin Notifications</h2>
                        <p>New reports submitted by users</p>
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
