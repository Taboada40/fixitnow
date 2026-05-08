import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    fetchLatestSessionProfile,
    mergeSessionProfile,
    useSession,
    clearSession,
    resolveSessionProfileId,
    resolveSessionProfileIdentifier
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
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const dropdownRef = useRef(null);
    const [isSyncingProfile, setIsSyncingProfile] = useState(true);
    const lastSyncedKeyRef = useRef('');

    const session = useSession();
    const profile = session?.profile || {};
    const displayName = profile?.firstName && profile?.firstName.trim()
        ? `${profile.firstName} ${(profile.lastName || '').trim()}`.trim()
        : (profile?.username || profile?.email || '');

    const profileImageSrc = profile?.profileImageUrl
        || (profile?.profileImage ? `data:${profile.profileImageContentType || 'image/jpeg'};base64,${profile.profileImage}` : null);
    const profileId = profile?.id || null;
    const profileIdentifier = profile?.email || session?.session?.user?.email || '';
    const profileSyncKey = `${String(profileId || '')}|${String(profileIdentifier || '')}`;

    const showProfileSkeleton = isSyncingProfile;

    // Close dropdown when clicking outside
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

    const persistAndPublishProfile = useCallback((latestProfile) => {
        mergeSessionProfile(latestProfile);
    }, []);

    const syncProfileFromDatabase = useCallback(async () => {
        const userId = profileId || resolveSessionProfileId();
        const identifier = profileIdentifier || resolveSessionProfileIdentifier();
        if (!userId && !identifier) {
            setIsSyncingProfile(false);
            return;
        }

        if (lastSyncedKeyRef.current === profileSyncKey) {
            setIsSyncingProfile(false);
            return;
        }

        setIsSyncingProfile(true);
        try {
            const latestProfile = await fetchLatestSessionProfile({ profileId: userId, identifier });
            if (latestProfile?.id || latestProfile?.email) {
                persistAndPublishProfile(latestProfile);
            }
        } catch (_) {
            // keep existing session profile when refresh fails
        } finally {
            lastSyncedKeyRef.current = profileSyncKey;
            setIsSyncingProfile(false);
        }
    }, [persistAndPublishProfile, profileId, profileIdentifier, profileSyncKey]);

    useEffect(() => {
        syncProfileFromDatabase();
    }, [syncProfileFromDatabase]);

    const handleLogout = () => {
        clearSession();
        setDropdownOpen(false);
        navigate('/login');
    };

    const handleNavigate = (path) => {
        setDropdownOpen(false);
        navigate(path);
    };

    const metadataRole = session?.session?.user?.user_metadata?.role || '';
    const role = (profile?.role || metadataRole || '').toUpperCase();
    const notificationsPath = role === 'ADMIN' ? '/admin/notifications' : '/notifications';
    const homePath = role === 'ADMIN' ? '/admin/dashboard' : '/dashboard';

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
                        onClick={() => !showProfileSkeleton && setDropdownOpen(!dropdownOpen)}
                        title={showProfileSkeleton ? 'Syncing profile...' : `Profile for ${displayName || 'User'}`}
                        aria-label="Profile menu"
                        disabled={showProfileSkeleton}
                    >
                        {showProfileSkeleton ? (
                            <>
                                <span className="top-nav-avatar-skeleton" aria-hidden="true" />
                                <span className="top-nav-name-skeleton" aria-hidden="true" />
                            </>
                        ) : profileImageSrc ? (
                            <img src={profileImageSrc} alt="Profile" className="top-nav-avatar-img" />
                        ) : (
                            <UserIcon />
                        )}
                        {!showProfileSkeleton && <span className="top-nav-profile-name">{displayName || 'User'}</span>}
                        {!showProfileSkeleton && <ChevronDownIcon />}
                    </button>

                    {dropdownOpen && !showProfileSkeleton && (
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
