import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { STATUS_COLORS, getErrorMessage, normalizeStatus } from '../utils/constants';
import { apiGet, resolveSessionProfileId, useSession } from '../utils/profileSession';

const SearchIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
);

const EyeIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7Z" />
        <circle cx="12" cy="12" r="3" />
    </svg>
);

const resolveIssueImageUrl = (issue = {}) =>
    issue?.imageUrl || issue?.image_url || issue?.imageName || issue?.image_name || '';

const buildSummaryFromReports = (items) => {
    const reports = Array.isArray(items) ? items : [];
    return {
        totalReports: reports.length,
        resolvedReports: reports.filter(r => normalizeStatus(r?.status) === 'Fixed').length,
        alertsCount: reports.filter(r => {
            const s = normalizeStatus(r?.status);
            return s === 'Pending' || s === 'In-Progress';
        }).length
    };
};

const Dashboard = () => {
    const navigate = useNavigate();
    const session = useSession();

    // Read profile from session only — no independent DB fetch or session write here.
    const profile = session?.profile || {};
    const metadataRole = session?.session?.user?.user_metadata?.role || '';
    const role = useMemo(() => (profile?.role || metadataRole || '').toUpperCase(), [profile?.role, metadataRole]);
    const activeUserId = profile?.id || resolveSessionProfileId();

    const [filter, setFilter] = useState('All');
    const [search, setSearch] = useState('');
    const [reports, setReports] = useState([]);
    const [summary, setSummary] = useState({ totalReports: 0, resolvedReports: 0, alertsCount: 0 });
    const [reportsError, setReportsError] = useState('');
    const [loadingReports, setLoadingReports] = useState(true);
    const [isInitialLoad, setIsInitialLoad] = useState(true);
    const isFetchingRef = useRef(false);
    const hasLoadedOnceRef = useRef(false);
    const [imagePreview, setImagePreview] = useState(null);
    const [imageError, setImageError] = useState(false);

    const loadReports = useCallback(async ({ showLoader = false } = {}) => {
        if (!activeUserId || isFetchingRef.current) return;

        isFetchingRef.current = true;
        if (showLoader) setLoadingReports(true);

        try {
            const [reportsRes, summaryRes] = await Promise.allSettled([
                apiGet('/api/reports', { params: { userId: activeUserId, _ts: Date.now() } }),
                apiGet('/api/reports/summary', { params: { userId: activeUserId, _ts: Date.now() } })
            ]);

            if (reportsRes.status === 'fulfilled') {
                const reportItems = Array.isArray(reportsRes.value.data) ? reportsRes.value.data : [];
                const scopedReports = reportItems.filter(item => Number(item?.userId) === Number(activeUserId));
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
                setReportsError('');
            } else {
                throw new Error('Failed to load reports data.');
            }
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
        if (!session) { navigate('/login'); return; }
        if (role === 'ADMIN') { navigate('/admin/dashboard'); return; }
        if (!activeUserId) {
            setReportsError('Unable to load dashboard. Please login again.');
            setLoadingReports(false);
            return;
        }

        loadReports({ showLoader: !hasLoadedOnceRef.current });

        let refreshTimeout;
        const handleRefresh = () => {
            clearTimeout(refreshTimeout);
            refreshTimeout = setTimeout(() => loadReports({ showLoader: false }), 1000);
        };
        const onFocus = handleRefresh;
        const onVisible = () => { if (document.visibilityState === 'visible') handleRefresh(); };

        window.addEventListener('focus', onFocus);
        document.addEventListener('visibilitychange', onVisible);
        return () => {
            window.removeEventListener('focus', onFocus);
            document.removeEventListener('visibilitychange', onVisible);
            clearTimeout(refreshTimeout);
        };
    }, [session, navigate, role, activeUserId, loadReports]);

    const filtered = useMemo(() => {
        return reports.filter(issue => {
            const status = normalizeStatus(issue.status);
            const text = (issue.description || issue.title || '').toLowerCase();
            const matchStatus = filter === 'All' || status === filter;
            const matchSearch = text.includes(search.toLowerCase());
            return matchStatus && matchSearch;
        });
    }, [reports, filter, search]);

    const handleViewImage = useCallback((issue) => {
        const imageUrl = resolveIssueImageUrl(issue);
        if (!imageUrl) return;
        setImageError(false);
        setImagePreview({
            url: imageUrl,
            title: issue?.title || 'Reported Issue',
            id: issue?.id
        });
    }, []);

    const closeImagePreview = useCallback(() => {
        setImagePreview(null);
        setImageError(false);
    }, []);

    return (
        <div className="db-wrapper">
            <main className="db-main">
                <h1 className="db-title ui-page-title">User Dashboard</h1>
                {reportsError && <div className="error-msg">{reportsError}</div>}

                <div className="db-stats">
                    <div className="db-stat-card">
                        <span className="db-stat-label">Active Reports</span>
                        <span className="db-stat-value">{String(summary.totalReports).padStart(2, '0')}</span>
                    </div>
                    <div className="db-stat-card">
                        <span className="db-stat-label">Resolved</span>
                        <span className="db-stat-value">{String(summary.resolvedReports).padStart(2, '0')}</span>
                    </div>
                    <div className="db-stat-card">
                        <span className="db-stat-label">Alerts</span>
                        <span className="db-stat-value">{String(summary.alertsCount).padStart(2, '0')}</span>
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
                            onChange={e => setSearch(e.target.value)}
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
                            const imageUrl = resolveIssueImageUrl(issue);
                            return (
                                <div key={issue.id} className="db-issue-card">
                                    <div className="db-issue-header">
                                        <div className="db-issue-id-group">
                                            <span className="db-issue-id">#{issue.id}</span>
                                            <span className="db-issue-status" style={{ backgroundColor: color }}>
                                                {status.replace('-', ' ')}
                                            </span>
                                        </div>
                                        <div className="db-issue-actions">
                                            <button
                                                className="db-issue-view-btn"
                                                type="button"
                                                title={imageUrl ? 'View image' : 'No image available'}
                                                aria-label={imageUrl ? 'View submitted image' : 'No image available'}
                                                onClick={() => handleViewImage(issue)}
                                                disabled={!imageUrl}
                                            >
                                                <EyeIcon />
                                            </button>
                                        </div>
                                    </div>
                                    <div className="db-issue-body">
                                        <h3 className="db-issue-title">{issue.title || 'Untitled Issue'}</h3>
                                        <p className="db-issue-desc">{issue.description || 'No description provided.'}</p>
                                        <div className="db-issue-meta">
                                            <span className="db-issue-location">📍 {issue.location || 'Unknown location'}</span>
                                            <span className="db-issue-date">
                                                {issue.createdAt || issue.created_at
                                                    ? new Date(issue.createdAt || issue.created_at).toLocaleDateString()
                                                    : 'No date'}
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
            {imagePreview && (
                <div className="db-image-modal" role="dialog" aria-modal="true" onClick={closeImagePreview}>
                    <div className="db-image-modal-card" onClick={(e) => e.stopPropagation()}>
                        <div className="db-image-modal-header">
                            <div className="db-image-modal-title">
                                {imagePreview.title}{imagePreview.id ? ` (#${imagePreview.id})` : ''}
                            </div>
                            <button
                                className="db-image-modal-close"
                                type="button"
                                onClick={closeImagePreview}
                                aria-label="Close image preview"
                            >
                                ✕
                            </button>
                        </div>
                        <div className="db-image-modal-body">
                            {imageError ? (
                                <div className="db-image-fallback">Image unavailable.</div>
                            ) : (
                                <img
                                    className="db-image-modal-img"
                                    src={imagePreview.url}
                                    alt={imagePreview.title}
                                    onError={() => setImageError(true)}
                                />
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Dashboard;
