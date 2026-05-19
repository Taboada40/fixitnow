import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getErrorMessage } from '../utils/constants';
import {
    apiDelete,
    apiGet,
    buildNotificationKey,
    getNotificationSeenAt,
    resolveSessionProfileId,
    setNotificationSeenAt,
    useSession
} from '../utils/profileSession';

const POLL_INTERVAL_MS = 8000;

const UserNotifications = () => {
    const navigate = useNavigate();
    const session = useSession();
    const profile = session?.profile || {};
    const userId = profile?.id || resolveSessionProfileId();
    const userEmail = profile?.email || session?.session?.user?.email || '';
    const metadataRole = session?.session?.user?.user_metadata?.role || '';
    const role = (profile?.role || metadataRole || 'STUDENT').toUpperCase();
    const notificationKey = useMemo(
        () => buildNotificationKey({ role, userId, email: userEmail }),
        [role, userId, userEmail]
    );

    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [deletingId, setDeletingId] = useState(null);

    const markNotificationsSeen = useCallback((items = []) => {
        if (!notificationKey) return;
        const latestTimestamp = items.reduce((max, item) => {
            const createdAt = item?.createdAt || item?.created_at;
            const timestamp = createdAt ? new Date(createdAt).getTime() : NaN;
            return Number.isFinite(timestamp) ? Math.max(max, timestamp) : max;
        }, 0);
        const currentSeenAt = getNotificationSeenAt(notificationKey);
        if (!latestTimestamp || latestTimestamp <= currentSeenAt) {
            return;
        }
        setNotificationSeenAt(notificationKey, latestTimestamp);
    }, [notificationKey]);

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
                const items = Array.isArray(res.data) ? res.data : [];
                setNotifications(items);
                markNotificationsSeen(items);
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
    }, [session, role, userId, navigate, markNotificationsSeen]);

    const handleDelete = async (id) => {
        if (!userId || !id) return;
        setDeletingId(id);
        setError('');
        try {
            await apiDelete(`/api/notifications/${id}`, { params: { userId } });
            setNotifications((prev) => prev.filter((item) => item.id !== id));
        } catch (err) {
            const message = getErrorMessage(err, 'Failed to delete notification.');
            setError(message);
        } finally {
            setDeletingId(null);
        }
    };

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
                                    <div className="reports-meta">
                                        {item.message} | {item.createdAt || item.created_at ? new Date(item.createdAt || item.created_at).toLocaleString() : '--'}
                                    </div>
                                </div>
                                <button
                                    className="reports-delete-btn"
                                    type="button"
                                    title="Delete notification"
                                    aria-label="Delete notification"
                                    onClick={() => handleDelete(item.id)}
                                    disabled={deletingId === item.id}
                                    style={{ padding: '6px 8px', minWidth: '36px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                                >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="3 6 5 6 21 6" />
                                        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                                        <path d="M10 11v6" />
                                        <path d="M14 11v6" />
                                        <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                                    </svg>
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default UserNotifications;
