import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { STATUS_OPTIONS, getErrorMessage, normalizeStatus } from '../utils/constants';
import { apiGet, apiPut, resolveSessionProfileId, useSession } from '../utils/profileSession';

const EyeIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7Z" />
        <circle cx="12" cy="12" r="3" />
    </svg>
);

const resolveIssueImageUrl = (issue = {}) =>
    issue?.imageUrl || issue?.image_url || issue?.imageName || issue?.image_name || '';

const AdminDashboard = () => {
    const navigate = useNavigate();
    const session = useSession();
    const profile = session?.profile || {};
    const metadataRole = session?.session?.user?.user_metadata?.role || '';
    const role = (profile?.role || metadataRole || '').toUpperCase();
    const adminUserId = profile?.id || resolveSessionProfileId();
    const adminEmail = profile?.email || session?.session?.user?.email || '';
    const adminAccessParams = useMemo(
        () => (adminUserId ? { adminUserId } : { adminEmail }),
        [adminUserId, adminEmail]
    );

    const [reports, setReports] = useState([]);
    const [summary, setSummary] = useState({
        usersCount: 0,
        reportsCount: 0,
        inProgressCount: 0,
        fixedCount: 0
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [updatingId, setUpdatingId] = useState(null);
    const successTimerRef = useRef(null);
    const [imagePreview, setImagePreview] = useState(null);
    const [imageError, setImageError] = useState(false);

    useEffect(() => {
        return () => {
            if (successTimerRef.current) {
                clearTimeout(successTimerRef.current);
            }
        };
    }, []);

    useEffect(() => {
        if (!session) {
            navigate('/login');
            return;
        }
        if (role !== 'ADMIN') {
            navigate('/dashboard');
            return;
        }

        const loadDashboardData = async () => {
            try {
                const [reportsRes, summaryRes] = await Promise.all([
                    apiGet('/api/admin/reports', { params: adminAccessParams }),
                    apiGet('/api/admin/summary', { params: adminAccessParams })
                ]);

                setReports(Array.isArray(reportsRes.data) ? reportsRes.data : []);
                setSummary({
                    usersCount: summaryRes.data?.usersCount || 0,
                    reportsCount: summaryRes.data?.reportsCount || 0,
                    inProgressCount: summaryRes.data?.inProgressCount || 0,
                    fixedCount: summaryRes.data?.fixedCount || 0
                });
            } catch (err) {
                const message = getErrorMessage(err, 'Failed to load admin dashboard.');
                setError(message);
            } finally {
                setLoading(false);
            }
        };

        loadDashboardData();
    }, [session, role, adminAccessParams, navigate]);

    const refreshSummary = async () => {
        try {
            const summaryRes = await apiGet('/api/admin/summary', { params: adminAccessParams });
            setSummary({
                usersCount: summaryRes.data?.usersCount || 0,
                reportsCount: summaryRes.data?.reportsCount || 0,
                inProgressCount: summaryRes.data?.inProgressCount || 0,
                fixedCount: summaryRes.data?.fixedCount || 0
            });
        } catch (err) {
            const message = getErrorMessage(err, 'Failed to refresh summary.');
            setError(message);
        }
    };

    const handleStatusChange = async (reportId, status) => {
        setError('');
        setSuccess('');
        setUpdatingId(reportId);
        try {
            const res = await apiPut(`/api/admin/reports/${reportId}/status`, {
                adminUserId,
                adminEmail,
                status
            });

            setReports((prev) => prev.map((item) => String(item.id) === String(reportId) ? res.data : item));
            await refreshSummary();
            setSuccess('Report status updated successfully.');
            if (successTimerRef.current) {
                clearTimeout(successTimerRef.current);
            }
            successTimerRef.current = setTimeout(() => {
                setSuccess('');
            }, 2500);
        } catch (err) {
            const message = getErrorMessage(err, 'Failed to update report status.');
            setError(message);
        } finally {
            setUpdatingId(null);
        }
    };

    const handleViewImage = (issue) => {
        const imageUrl = resolveIssueImageUrl(issue);
        if (!imageUrl) return;
        setImageError(false);
        setImagePreview({
            url: imageUrl,
            title: issue?.description || issue?.title || 'Reported Issue',
            id: issue?.id
        });
    };

    const closeImagePreview = () => {
        setImagePreview(null);
        setImageError(false);
    };

    return (
        <div className="profile-page">
            <div className="profile-card admin-dashboard-card">
                <div className="profile-top">
                    <div>
                            <h2 className="ui-page-title">Admin Dashboard</h2>
                        <p>System overview and report review workflow</p>
                    </div>
                </div>

                {error && <div className="error-msg">{error}</div>}
                {success && <div className="success-msg">{success}</div>}

                {loading ? (
                    <div className="reports-loading">Loading reports...</div>
                ) : (
                    <>
                        <div className="admin-stats-grid">
                            <div className="admin-stat-card">
                                <span className="admin-stat-label">Registered Users</span>
                                <span className="admin-stat-value">{String(summary.usersCount).padStart(2, '0')}</span>
                            </div>
                            <div className="admin-stat-card">
                                <span className="admin-stat-label">Reported Issues</span>
                                <span className="admin-stat-value">{String(summary.reportsCount).padStart(2, '0')}</span>
                            </div>
                            <div className="admin-stat-card">
                                <span className="admin-stat-label">In Progress</span>
                                <span className="admin-stat-value">{String(summary.inProgressCount).padStart(2, '0')}</span>
                            </div>
                            <div className="admin-stat-card">
                                <span className="admin-stat-label">Fixed</span>
                                <span className="admin-stat-value">{String(summary.fixedCount).padStart(2, '0')}</span>
                            </div>
                        </div>

                        {reports.length === 0 ? (
                            <div className="reports-empty">No reports available.</div>
                        ) : (
                            <div className="admin-table-wrap">
                                <table className="admin-table">
                                    <thead>
                                        <tr>
                                            <th>User</th>
                                            <th>Description</th>
                                            <th>Location</th>
                                            <th>Status</th>
                                            <th>Image</th>
                                            <th>Created</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {reports.map((item) => {
                                            const imageUrl = resolveIssueImageUrl(item);
                                            return (
                                            <tr key={item.id}>
                                                <td>{item.email}</td>
                                                <td>{item.description || item.title}</td>
                                                <td>{item.location || 'Unspecified'}</td>
                                                <td>
                                                    <select
                                                        className="admin-status-select ui-select"
                                                        value={normalizeStatus(item.status)}
                                                        disabled={updatingId === item.id}
                                                        onChange={(e) => handleStatusChange(item.id, e.target.value)}
                                                    >
                                                        {STATUS_OPTIONS.map((option) => (
                                                            <option key={option} value={option}>{option}</option>
                                                        ))}
                                                    </select>
                                                </td>
                                                <td className="admin-image-cell">
                                                    <button
                                                        className="db-issue-view-btn"
                                                        type="button"
                                                        title={imageUrl ? 'View image' : 'No image available'}
                                                        aria-label={imageUrl ? 'View submitted image' : 'No image available'}
                                                        onClick={() => handleViewImage(item)}
                                                        disabled={!imageUrl}
                                                    >
                                                        <EyeIcon />
                                                    </button>
                                                </td>
                                                <td>
                                                    {item.createdAt || item.created_at
                                                        ? new Date(item.createdAt || item.created_at).toLocaleString()
                                                        : '--'}
                                                </td>
                                            </tr>
                                        );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </>
                )}
            </div>
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

export default AdminDashboard;
