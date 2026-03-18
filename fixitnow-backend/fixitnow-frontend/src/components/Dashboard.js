import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

// Simple SVG icons inline (no extra dependencies)
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

const SearchIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
);

const STATUS_COLORS = {
    'In-Progress': '#FFCC00',
    'Pending':     '#aaaaaa',
    'Fixed':       '#4ade80',
    'Cancelled':   '#ff8a8a',
};

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

const normalizeStatus = (value) => {
    const status = String(value || '').trim().toLowerCase();
    if (status === 'in-progress') {
        return 'In-Progress';
    }
    if (status === 'fixed') {
        return 'Fixed';
    }
    if (status === 'cancelled') {
        return 'Cancelled';
    }
    return 'Pending';
};

const buildSummaryFromReports = (items) => {
    const reports = Array.isArray(items) ? items : [];
    const totalReports = reports.length;
    const resolvedReports = reports.filter((report) => normalizeStatus(report?.status) === 'Fixed').length;

    return {
        totalReports,
        resolvedReports,
        alertsCount: Math.max(totalReports - resolvedReports, 0)
    };
};

const API_BASE = 'http://localhost:8080';

const persistFreshProfile = (nextProfile) => {
    try {
        const raw = localStorage.getItem('session');
        if (!raw) {
            return;
        }
        const parsed = JSON.parse(raw);
        const updated = {
            ...parsed,
            profile: {
                ...(parsed?.profile || {}),
                ...(nextProfile || {})
            }
        };
        localStorage.setItem('session', JSON.stringify(updated));
    } catch (_) {
        // Keep dashboard usable even if session storage update fails.
    }
};

const Dashboard = () => {
    const navigate = useNavigate();
    const storedSession = useMemo(() => JSON.parse(localStorage.getItem('session') || 'null'), []);
    const authSession = storedSession?.session || storedSession;
    const storedProfile = storedSession?.profile || {};
    const [freshProfile, setFreshProfile] = useState(storedProfile);
    const role = (freshProfile?.role || storedProfile?.role || 'STUDENT').toUpperCase();
    const userMeta = authSession?.user?.user_metadata || {};
    const displayName = freshProfile?.firstName
        ? `${freshProfile.firstName} ${freshProfile.lastName || ''}`.trim()
        : (userMeta.first_name
            ? `${userMeta.first_name} ${userMeta.last_name || ''}`.trim()
            : (freshProfile?.username || storedProfile?.username || userMeta.username || authSession?.user?.email || 'Student'));

    const [filter, setFilter] = useState('All');
    const [search, setSearch]   = useState('');
    const [reports, setReports] = useState([]);
    const [summary, setSummary] = useState({
        totalReports: 0,
        resolvedReports: 0,
        alertsCount: 0
    });
    const [reportsError, setReportsError] = useState('');
    const [loadingReports, setLoadingReports] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [lastSyncedAt, setLastSyncedAt] = useState(null);
    const refreshTimerRef = useRef(null);
    const activeUserId = freshProfile?.id || storedProfile?.id || null;

    const loadDashboardData = useCallback(async (isInitial = false) => {
        if (!activeUserId) {
            setReportsError('Unable to load dashboard. Please login again.');
            setLoadingReports(false);
            return;
        }

        if (isInitial) {
            setLoadingReports(true);
        } else {
            setRefreshing(true);
        }

        try {
            const profileRes = await axios.get(
                `${API_BASE}/api/profile/by-id?userId=${encodeURIComponent(activeUserId)}&_ts=${Date.now()}`,
                { withCredentials: true }
            );
            const latestProfile = profileRes?.data || {};
            const latestUserId = latestProfile?.id;

            if (!latestUserId) {
                throw new Error('Authenticated profile ID is missing.');
            }

            setFreshProfile(latestProfile);
            persistFreshProfile(latestProfile);

            const reportsRes = await axios.get(
                `${API_BASE}/api/reports?userId=${encodeURIComponent(latestUserId)}&_ts=${Date.now()}`,
                { withCredentials: true }
            );

            const reportItems = Array.isArray(reportsRes.data) ? reportsRes.data : [];
            const scopedReports = latestUserId
                ? reportItems.filter((item) => Number(item?.userId) === Number(latestUserId))
                : reportItems;
            setReports(scopedReports);

            try {
                const summaryRes = await axios.get(
                    `${API_BASE}/api/reports/summary?userId=${encodeURIComponent(latestUserId)}&_ts=${Date.now()}`,
                    { withCredentials: true }
                );

                setSummary({
                    totalReports: Number(summaryRes?.data?.totalReports || 0),
                    resolvedReports: Number(summaryRes?.data?.resolvedReports || 0),
                    alertsCount: Number(summaryRes?.data?.alertsCount || 0)
                });
            } catch (_) {
                setSummary(buildSummaryFromReports(scopedReports));
            }

            setLastSyncedAt(new Date());
            setReportsError('');
        } catch (err) {
            const message = !err?.response
                ? 'Cannot reach server. Please make sure backend is running on port 8080.'
                : getErrorMessage(err, 'Failed to load dashboard data.');
            setReportsError(message);
        } finally {
            if (isInitial) {
                setLoadingReports(false);
            }
            setRefreshing(false);
        }
    }, [activeUserId]);

    useEffect(() => {
        return () => {
            if (refreshTimerRef.current) {
                clearInterval(refreshTimerRef.current);
            }
        };
    }, []);

    useEffect(() => {
        if (!storedSession) {
            navigate('/login');
            return;
        }
        if (role === 'ADMIN') {
            navigate('/admin/dashboard');
            return;
        }

        loadDashboardData(true);

        const onFocus = () => loadDashboardData(false);
        const onVisible = () => {
            if (document.visibilityState === 'visible') {
                loadDashboardData(false);
            }
        };

        window.addEventListener('focus', onFocus);
        document.addEventListener('visibilitychange', onVisible);

        if (refreshTimerRef.current) {
            clearInterval(refreshTimerRef.current);
        }
        refreshTimerRef.current = setInterval(() => {
            loadDashboardData(false);
        }, 8000);

        return () => {
            window.removeEventListener('focus', onFocus);
            document.removeEventListener('visibilitychange', onVisible);
            if (refreshTimerRef.current) {
                clearInterval(refreshTimerRef.current);
                refreshTimerRef.current = null;
            }
        };
    }, [storedSession, navigate, role, loadDashboardData]);

    const filtered = reports.filter(issue => {
        const status = normalizeStatus(issue.status);
        const text = (issue.description || issue.title || '').toLowerCase();
        const matchStatus = filter === 'All' || status === filter;
        const matchSearch = text.includes(search.toLowerCase());
        return matchStatus && matchSearch;
    });

    const activeCount   = summary.totalReports;
    const resolvedCount = summary.resolvedReports;
    const alertCount    = summary.alertsCount;

    const handleLogout = () => {
        localStorage.removeItem('session');
        navigate('/login');
    };

    return (
        <div className="db-wrapper">
            {/* ── Top Navbar ── */}
            <nav className="db-navbar">
                <span className="db-nav-label">Dashboard Page</span>
                <div className="db-nav-icons">
                    <button className="db-icon-btn" onClick={() => navigate('/dashboard')} title="Home">
                        <HomeIcon />
                    </button>
                    <button className="db-icon-btn" onClick={() => navigate('/notifications')} title="Notifications">
                        <BellIcon />
                    </button>
                    <button className="db-icon-btn" onClick={() => navigate('/profile')} title={`Open profile for ${displayName}`}>
                        <UserIcon />
                    </button>
                    <button className="db-logout-btn" onClick={handleLogout}>
                        Logout
                    </button>
                </div>
            </nav>

            {/* ── Main Content ── */}
            <main className="db-main">
                <h1 className="db-title">User Dashboard</h1>
                <div
                    className="db-sync-row"
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '14px',
                        padding: '10px 12px',
                        borderRadius: '10px',
                        background: 'rgba(255,255,255,0.06)',
                        border: '1px solid rgba(255,255,255,0.12)'
                    }}
                >
                    <span className="db-sync-label" style={{ fontSize: '13px', opacity: 0.9 }}>
                        {lastSyncedAt ? `Last synced: ${lastSyncedAt.toLocaleTimeString()}` : 'Sync pending...'}
                    </span>
                    <button
                        className="profile-nav-btn"
                        style={{ minWidth: '110px' }}
                        onClick={() => loadDashboardData(false)}
                        disabled={loadingReports || refreshing || !activeUserId}
                    >
                        {refreshing ? 'Refreshing...' : 'Refresh'}
                    </button>
                </div>
                {reportsError && <div className="error-msg">{reportsError}</div>}

                {/* ── Stat Cards ── */}
                <div className="db-stats">
                    <div className="db-stat-card">
                        <span className="db-stat-label">Active Reports</span>
                        <span className="db-stat-value">{String(activeCount).padStart(2, '0')}</span>
                    </div>
                    <div className="db-stat-card">
                        <span className="db-stat-label">Resolved</span>
                        <span className="db-stat-value">{String(resolvedCount).padStart(2, '0')}</span>
                    </div>
                    <div className="db-stat-card">
                        <span className="db-stat-label">Alerts</span>
                        <span className="db-stat-value">{String(alertCount).padStart(2, '0')}</span>
                    </div>
                </div>

                {/* ── Reported Issues ── */}
                <h2 className="db-section-title">Reported Issue</h2>

                <div className="db-controls">
                    <div className="db-filter-wrap">
                        <select
                            className="db-filter"
                            value={filter}
                            onChange={e => setFilter(e.target.value)}
                        >
                            <option>All</option>
                            <option>In-Progress</option>
                            <option>Pending</option>
                            <option>Fixed</option>
                            <option>Cancelled</option>
                        </select>
                    </div>
                    <div className="db-search-wrap">
                        <input
                            className="db-search"
                            type="text"
                            placeholder="Search your reported issue"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                        <span className="db-search-icon"><SearchIcon /></span>
                    </div>
                </div>

                <div className="db-issues-box">
                    {loadingReports ? (
                        <p className="db-no-issues">Loading reports...</p>
                    ) : filtered.length === 0 ? (
                        <p className="db-no-issues">No issues match your filter.</p>
                    ) : (
                        filtered.map(issue => (
                            <div key={issue.id} className="db-issue-row">
                                <span
                                    className="db-issue-status"
                                    style={{ color: STATUS_COLORS[normalizeStatus(issue.status)] || '#fff' }}
                                >
                                    {normalizeStatus(issue.status)}
                                </span>
                                <div className="db-issue-bar">
                                    <span className="db-issue-title">{issue.description || issue.title}</span>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <div className="db-footer">
                    <button className="db-report-btn" onClick={() => navigate('/report-issue')}
                    >
                        Report an Issue
                    </button>
                </div>
            </main>
        </div>
    );
};
export default Dashboard;