import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    useSession,
    clearSession,
    apiGet,
    buildNotificationKey,
    getNotificationSeenAt
} from '../utils/profileSession';

const HomeIcon = () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
);

const BellIcon = () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
);

const UserIcon = () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
    </svg>
);

const ChevronDownIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="6 9 12 15 18 9" />
    </svg>
);

const TopNavBar = () => {
    const navigate = useNavigate();
    const session = useSession();
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const dropdownRef = useRef(null);

    // Read profile directly from session — no independent DB fetch here.
    // Profile.js and Login.js are the sole owners of session writes.
    const profile = session?.profile || {};
    const displayName = profile?.firstName && profile.firstName.trim()
        ? `${profile.firstName} ${(profile.lastName || '').trim()}`.trim()
        : (profile?.username || profile?.email || '');
    const profileImageSrc = profile?.profileImageUrl || null;

    const metadataRole = session?.session?.user?.user_metadata?.role || '';
    const role = (profile?.role || metadataRole || '').toUpperCase();
    const sessionEmail = profile?.email || session?.session?.user?.email || '';
    const sessionUserId = profile?.id || session?.session?.user?.id || null;
    const adminAccessParams = useMemo(
        () => (sessionUserId ? { adminUserId: sessionUserId } : { adminEmail: sessionEmail }),
        [sessionUserId, sessionEmail]
    );
    const notificationKey = useMemo(
        () => buildNotificationKey({ role, userId: sessionUserId, email: sessionEmail }),
        [role, sessionUserId, sessionEmail]
    );
    const notificationSeenAt = getNotificationSeenAt(notificationKey);
    const [notificationItems, setNotificationItems] = useState([]);

    const notificationsPath = role === 'ADMIN' ? '/admin/notifications' : '/notifications';
    const homePath = role === 'ADMIN' ? '/admin/dashboard' : '/dashboard';

    const computeUnseenCount = useCallback((items, seenAt) => {
        const list = Array.isArray(items) ? items : [];
        return list.filter((item) => {
            const createdAt = item?.createdAt || item?.created_at;
            const timestamp = createdAt ? new Date(createdAt).getTime() : NaN;
            if (!Number.isFinite(timestamp)) {
                return true;
            }
            return timestamp > seenAt;
        }).length;
    }, []);

    const notificationCount = useMemo(
        () => computeUnseenCount(notificationItems, notificationSeenAt),
        [notificationItems, notificationSeenAt, computeUnseenCount]
    );

    const badgeText = notificationCount > 9 ? '+9' : `+${notificationCount}`;

    const loadNotifications = useCallback(async () => {
        if (!session) {
            setNotificationItems([]);
            return;
        }
        try {
            if (role === 'ADMIN') {
                if (!adminAccessParams.adminUserId && !adminAccessParams.adminEmail) return;
                const res = await apiGet('/api/admin/notifications', { params: adminAccessParams });
                setNotificationItems(Array.isArray(res.data) ? res.data : []);
                return;
            }
            if (!sessionUserId) return;
            const res = await apiGet('/api/notifications', { params: { userId: sessionUserId } });
            setNotificationItems(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            setNotificationItems([]);
        }
    }, [session, role, adminAccessParams, sessionUserId]);

    useEffect(() => {
        if (!session) {
            setNotificationItems([]);
            return;
        }
        loadNotifications();
        const intervalId = setInterval(loadNotifications, 15000);
        const onFocus = () => loadNotifications();
        window.addEventListener('focus', onFocus);
        return () => {
            clearInterval(intervalId);
            window.removeEventListener('focus', onFocus);
        };
    }, [session, loadNotifications]);

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setDropdownOpen(false);
            }
        };
        if (dropdownOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [dropdownOpen]);

    const handleLogout = () => {
        clearSession();
        setDropdownOpen(false);
        navigate('/login');
    };

    const handleNavigate = (path) => {
        setDropdownOpen(false);
        navigate(path);
    };

    return (
        <nav className="top-navbar">
            <div className="top-navbar-left">
                <span className="top-navbar-brand">FixItNow</span>
            </div>

            <div className="top-navbar-right">
                <button
                    className="top-nav-icon-btn"
                    onClick={() => handleNavigate(homePath)}
                    title="Home"
                    aria-label="Go to dashboard"
                >
                    <HomeIcon />
                </button>

                <button
                    className="top-nav-icon-btn"
                    onClick={() => handleNavigate(notificationsPath)}
                    title="Notifications"
                    aria-label={`View notifications${notificationCount > 0 ? ` (${notificationCount} new)` : ''}`}
                >
                    <span style={{ position: 'relative', display: 'inline-flex' }}>
                        <BellIcon />
                        {notificationCount > 0 && (
                            <span
                                style={{
                                    position: 'absolute',
                                    top: '-6px',
                                    right: '-6px',
                                    minWidth: '18px',
                                    height: '18px',
                                    padding: '0 5px',
                                    borderRadius: '999px',
                                    background: 'var(--error)',
                                    color: '#fff',
                                    fontSize: '0.65rem',
                                    fontWeight: 800,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    border: '1px solid var(--bg-navbar)',
                                    lineHeight: 1
                                }}
                            >
                                {badgeText}
                            </span>
                        )}
                    </span>
                </button>

                <div className="top-nav-dropdown" ref={dropdownRef}>
                    <button
                        className="top-nav-profile-btn"
                        onClick={() => setDropdownOpen(prev => !prev)}
                        title={`Profile for ${displayName || 'User'}`}
                        aria-label="Profile menu"
                    >
                        {profileImageSrc ? (
                            <img src={profileImageSrc} alt="Profile" className="top-nav-avatar-img" />
                        ) : (
                            <UserIcon />
                        )}
                        <span className="top-nav-profile-name">{displayName || 'User'}</span>
                        <ChevronDownIcon />
                    </button>

                    {dropdownOpen && (
                        <div className="top-nav-dropdown-menu">
                            <button
                                className="top-nav-dropdown-item"
                                onClick={() => handleNavigate('/profile')}
                            >
                                Profile
                            </button>
                            <button
                                className="top-nav-dropdown-item danger"
                                onClick={handleLogout}
                            >
                                Logout
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </nav>
    );
};

export default TopNavBar;
