import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    useSession,
    clearSession
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
    const notificationsPath = role === 'ADMIN' ? '/admin/notifications' : '/notifications';
    const homePath = role === 'ADMIN' ? '/admin/dashboard' : '/dashboard';

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
                    aria-label="View notifications"
                >
                    <BellIcon />
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