import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { STATUS_COLORS, getErrorMessage, normalizeStatus } from '../utils/constants';
import {
    apiGet,
    fetchProfileById,
    mergeSessionProfile as persistProfileSession,
    useSession
} from '../utils/profileSession';

const SearchIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
);

const buildSummaryFromReports = (items) => {
    const reports = Array.isArray(items) ? items : [];
    const totalReports = reports.length;
    const resolvedReports = reports.filter((report) => normalizeStatus(report?.status) === 'Fixed').length;
    const alertsCount = reports.filter((report) => {
        const status = normalizeStatus(report?.status);
        return status === 'Pending' || status === 'In-Progress';
    }).length;

    return {
        totalReports,
        resolvedReports,
        alertsCount
    };
};

const persistFreshProfile = (nextProfile) => {
    persistProfileSession(nextProfile);
};

const Dashboard = () => {
    const navigate = useNavigate();
    const session = useSession();
    
    const storedProfile = session?.profile || {};
    const [freshProfile, setFreshProfile] = useState(storedProfile);
    const role = useMemo(() => (freshProfile?.role || storedProfile?.role || 'STUDENT').toUpperCase(), [freshProfile?.role, storedProfile?.role]);

    const [filter, setFilter] = useState('All');
    const [search, setSearch] = useState('');
    const [reports, setReports] = useState([]);
    const [summary, setSummary] = useState({
        totalReports: 0,
        resolvedReports: 0,
        alertsCount: 0
    });
    const [reportsError, setReportsError] = useState('');
    const [loadingReports, setLoadingReports] = useState(true);
    const [isInitialLoad, setIsInitialLoad] = useState(true);
    const isFetchingRef = useRef(false);
    const hasLoadedOnceRef = useRef(false);
    
    const activeUserId = useMemo(() => freshProfile?.id || storedProfile?.id || null, [freshProfile?.id, storedProfile?.id]);

    const loadDashboardData = useCallback(async ({ showLoader = false } = {}) => {
        if (!activeUserId) {
            setReportsError('Unable to load dashboard. Please login again.');
            setLoadingReports(false);
            return;
        }

        if (isFetchingRef.current) {
            return;
        }

        isFetchingRef.current = true;
        if (showLoader) {
            setLoadingReports(true);
        }

        try {
            const [profileRes, reportsRes, summaryRes] = await Promise.allSettled([
                fetchProfileById(activeUserId),
                apiGet('/api/reports', {
                    params: { userId: activeUserId, _ts: Date.now() }
                }),
                apiGet('/api/reports/summary', {
                    params: { userId: activeUserId, _ts: Date.now() }
                })
            ]);

            if (profileRes.status === 'fulfilled') {
                const latestProfile = profileRes.value;
                if (latestProfile?.id) {
                    setFreshProfile(latestProfile);
                    persistFreshProfile(latestProfile);
                } else {
                    throw new Error('Authenticated profile ID is missing.');
                }
            } else {
                throw new Error('Failed to load profile data.');
            }

            if (reportsRes.status === 'fulfilled') {
                const reportItems = Array.isArray(reportsRes.value.data) ? reportsRes.value.data : [];
                const scopedReports = activeUserId
                    ? reportItems.filter((item) => Number(item?.userId) === Number(activeUserId))
                    : reportItems;
                setReports(scopedReports);

                if (summaryRes.status === 'fulfilled') {
                    setSummary({
                        totalReports: Number(summaryRes.value.data?.totalReports || 0),
                        resolvedReports: Number(summaryRes.value.data?.resolvedReports || 0),
                        alertsCount: Number(summaryRes.value.data?.alertsCount || 0)
                    });
                } else {
                    setSummary(buildSummaryFromReports(scopedReports));
                }
            } else {
                throw new Error('Failed to load reports data.');
            }

            setReportsError('');
        } catch (err) {
            const message = !err?.response
                ? 'Cannot reach server. Please make sure backend is running on port 8080.'
                : getErrorMessage(err, 'Failed to load dashboard data.');
            setReportsError(message);
        } finally {
            setLoadingReports(false);
            isFetchingRef.current = false;
            if (showLoader) {
                setIsInitialLoad(false);
                hasLoadedOnceRef.current = true;
            }
        }
    }, [activeUserId]);

    useEffect(() => {
        hasLoadedOnceRef.current = false;
        setIsInitialLoad(true);
        setLoadingReports(true);
    }, [activeUserId]);

    useEffect(() => {
        if (!session) {
            navigate('/login');
            return;
        }
        if (role === 'ADMIN') {
            navigate('/admin/dashboard');
            return;
        }

        loadDashboardData({ showLoader: !hasLoadedOnceRef.current });

        let refreshTimeout;
        const handleRefresh = () => {
            clearTimeout(refreshTimeout);
            refreshTimeout = setTimeout(() => {
                loadDashboardData({ showLoader: false });
            }, 1000);
        };

        const onFocus = handleRefresh;
        const onVisible = () => {
            if (document.visibilityState === 'visible') {
                handleRefresh();
            }
        };
        
        window.addEventListener('focus', onFocus);
        document.addEventListener('visibilitychange', onVisible);

        return () => {
            window.removeEventListener('focus', onFocus);
            document.removeEventListener('visibilitychange', onVisible);
            clearTimeout(refreshTimeout);
        };
    }, [session, navigate, role, loadDashboardData]);

    const handleSearchChange = (value) => {
        setSearch(value);
    };

    const filtered = useMemo(() => {
        return reports.filter(issue => {
            const status = normalizeStatus(issue.status);
            const text = (issue.description || issue.title || '').toLowerCase();
            const matchStatus = filter === 'All' || status === filter;
            const matchSearch = text.includes(search.toLowerCase());
            return matchStatus && matchSearch;
        });
    }, [reports, filter, search]);

    const activeCount   = summary.totalReports;
    const resolvedCount = summary.resolvedReports;
    const alertCount    = summary.alertsCount;

    return (
        <div className="db-wrapper">
            <main className="db-main">
                <h1 className="db-title ui-page-title">User Dashboard</h1>
                {reportsError && <div className="error-msg">{reportsError}</div>}

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

                <h2 className="db-section-title ui-section-title">Reported Issue</h2>

                <div className="db-controls">
                    <div className="db-filter-wrap">
                        <select
                            className="db-filter ui-select"
                            value={filter}
                            onChange={e => setFilter(e.target.value)}
                        >
                            <option>All</option>
                            <option>Pending</option>
                            <option>In-Progress</option>
                            <option>Fixed</option>
                            <option>Cancelled</option>
                        </select>
                    </div>
                    <div className="db-search-wrap">
                        <input
                            className="db-search ui-input"
                            type="text"
                            placeholder="Search your reported issue"
                            value={search}
                            onChange={e => handleSearchChange(e.target.value)}
                        />
                        <span className="db-search-icon"><SearchIcon /></span>
                    </div>
                </div>

                <div className="db-issues-box">
                    {loadingReports && isInitialLoad ? (
                        <p className="db-no-issues">Loading reports...</p>
                    ) : filtered.length === 0 ? (
                        <p className="db-no-issues">No issues match your filter.</p>
                    ) : (
                        filtered.map(issue => {
                            const status = normalizeStatus(issue.status);
                            const color = STATUS_COLORS[status] || STATUS_COLORS.default;
                            const statusDisplay = status.replace('-', ' ');

                            return (
                                <div key={issue.id} className="db-issue-card">
                                    <div className="db-issue-header">
                                        <div className="db-issue-id-group">
                                            <span className="db-issue-id">#{issue.id}</span>
                                            <span className="db-issue-status" style={{ backgroundColor: color }}>
                                                {statusDisplay}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="db-issue-body">
                                        <h3 className="db-issue-title">{issue.title || 'Untitled Issue'}</h3>
                                        <p className="db-issue-desc">{issue.description || 'No description provided.'}</p>
                                        <div className="db-issue-meta">
                                            <span className="db-issue-location">📍 {issue.location || 'Unknown location'}</span>
                                            <span className="db-issue-date">
                                                {issue.createdAt ? new Date(issue.createdAt).toLocaleDateString() : 'No date'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                <div className="db-footer">
                    <button 
                        className="db-report-btn ui-button ui-button--primary"
                        onClick={() => navigate('/report-issue')}
                    >
                        + Report Issue
                    </button>
                </div>
            </main>
        </div>
    );
};

export default Dashboard;
