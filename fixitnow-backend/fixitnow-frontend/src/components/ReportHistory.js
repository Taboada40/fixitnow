import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getErrorMessage } from '../utils/constants';
import { apiDelete, apiGet, useSession } from '../utils/profileSession';

const ReportHistory = () => {
    const navigate = useNavigate();
    const session = useSession();
    const profile = session?.profile || {};
    const metadataRole = session?.session?.user?.user_metadata?.role || '';
    const role = (profile?.role || metadataRole || 'STUDENT').toUpperCase();
    const userId = profile?.id;

    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!session) {
            navigate('/login');
            return;
        }
        if (role === 'ADMIN') {
            navigate('/admin/dashboard');
            return;
        }

        const fetchReports = async () => {
            if (!userId) {
                setLoading(false);
                setError('Unable to load reports. Please login again.');
                return;
            }

            try {
                const res = await apiGet('/api/reports', { params: { userId } });
                setReports(Array.isArray(res.data) ? res.data : []);
            } catch (err) {
                const message = getErrorMessage(err, 'Failed to load report history.');
                setError(message);
            } finally {
                setLoading(false);
            }
        };

        fetchReports();
    }, [session, navigate, userId, role]);

    const deleteReport = async (id) => {
        if (!userId) {
            return;
        }

        try {
            await apiDelete(`/api/reports/${id}`, { params: { userId } });
            setReports((prev) => prev.filter((item) => item.id !== id));
        } catch (err) {
            const message = getErrorMessage(err, 'Failed to delete report.');
            setError(message);
        }
    };

    const fixedReports = reports.filter((item) => String(item.status || '').toLowerCase() === 'fixed');

    return (
        <div className="profile-page">
            <div className="profile-card">
                <div className="profile-top">
                    <div>
                        <h2 className="ui-page-title">Report History</h2>
                        <p>Showing fixed reports only</p>
                    </div>
                </div>

                {error && <div className="error-msg">{error}</div>}

                {loading ? (
                    <div className="reports-loading">Loading reports...</div>
                ) : fixedReports.length === 0 ? (
                    <div className="reports-empty">No fixed reports yet.</div>
                ) : (
                    <div className="reports-list">
                        {fixedReports.map((item) => (
                            <div key={item.id} className="reports-row">
                                <div className="reports-row-main">
                                    <div className="reports-title">{item.description || item.title}</div>
                                    <div className="reports-meta">Location: {item.location || 'Unspecified'} | Status: {item.status} | Created: {new Date(item.createdAt).toLocaleString()}</div>
                                </div>
                                <button
                                    className="ui-button ui-button--danger"
                                    type="button"
                                    onClick={() => deleteReport(item.id)}
                                    aria-label={`Delete report ${item.title || item.description}`}
                                >
                                    Delete
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ReportHistory;
