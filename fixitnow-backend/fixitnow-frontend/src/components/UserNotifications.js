import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getErrorMessage } from '../utils/constants';
import { apiGet, resolveSessionProfileId, useSession } from '../utils/profileSession';

const POLL_INTERVAL_MS = 8000;

const UserNotifications = () => {
    const navigate = useNavigate();
    const session = useSession();
    const profile = session?.profile || {};
    const userId = profile?.id || resolveSessionProfileId();
    const metadataRole = session?.session?.user?.user_metadata?.role || '';
    const role = (profile?.role || metadataRole || 'STUDENT').toUpperCase();

    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!session) {
            navigate('/login');
            return;
        }
        if (role === 'ADMIN') {
            navigate('/admin/notifications');
            return;
        }

        const loadNotifications = async () => {
            if (!userId) {
                setError('Unable to load notifications. Please login again.');
                setLoading(false);
                return;
            }

            try {
                const res = await apiGet('/api/notifications', { params: { userId } });
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
    }, [session, role, userId, navigate]);

    return (
        <div className="profile-page">
            <div className="profile-card">
                <div className="profile-top">
                    <div>
                            <h2 className="ui-page-title">Notifications</h2>
                        <p>Updates when admin reviews your reports</p>
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
