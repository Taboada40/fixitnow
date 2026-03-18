import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const ReportHistory = () => {
    const navigate = useNavigate();
    const storedSession = useMemo(() => JSON.parse(localStorage.getItem('session') || 'null'), []);
    const role = (storedSession?.profile?.role || 'STUDENT').toUpperCase();
    const userId = storedSession?.profile?.id;

    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!storedSession) {
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
                const res = await axios.get(`http://localhost:8080/api/reports?userId=${encodeURIComponent(userId)}`, {
                    withCredentials: true
                });
                setReports(Array.isArray(res.data) ? res.data : []);
            } catch (err) {
                const message = err.response?.data?.message || 'Failed to load report history.';
                setError(message);
            } finally {
                setLoading(false);
            }
        };

        fetchReports();
    }, [storedSession, navigate, userId, role]);

    const deleteReport = async (id) => {
        if (!userId) {
            return;
        }

        try {
            await axios.delete(`http://localhost:8080/api/reports/${id}?userId=${encodeURIComponent(userId)}`, {
                withCredentials: true
            });
            setReports((prev) => prev.filter((item) => item.id !== id));
        } catch (err) {
            const message = err.response?.data?.message || 'Failed to delete report.';
            setError(message);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('session');
        navigate('/login');
    };

    const fixedReports = reports.filter((item) => String(item.status || '').toLowerCase() === 'fixed');

    return (
        <div className="profile-page">
            <div className="profile-card">
                <div className="profile-top">
                    <div>
                        <h2>Report History</h2>
                        <p>Showing fixed reports only</p>
                    </div>
                    <div className="profile-top-actions">
                        <button className="profile-nav-btn" onClick={() => navigate('/dashboard')}>Dashboard</button>
                        <button className="profile-nav-btn" onClick={() => navigate('/notifications')}>Notifications</button>
                        <button className="profile-nav-btn" onClick={() => navigate('/profile')}>Profile</button>
                        <button className="profile-nav-btn danger" onClick={handleLogout}>Logout</button>
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
                                    className="reports-delete-btn"
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
