import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const ReportIssue = () => {
    const navigate = useNavigate();
    const storedSession = useMemo(() => JSON.parse(localStorage.getItem('session') || 'null'), []);
    const role = (storedSession?.profile?.role || 'STUDENT').toUpperCase();
    const userId = storedSession?.profile?.id;

    const [formData, setFormData] = useState({
        description: '',
        location: '',
        imageName: ''
    });
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (!storedSession) {
            navigate('/login');
            return;
        }
        if (role === 'ADMIN') {
            navigate('/admin/dashboard');
        }
    }, [storedSession, navigate, role]);

    if (!storedSession) {
        return null;
    }

    const handleLogout = () => {
        localStorage.removeItem('session');
        navigate('/login');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        if (!userId) {
            setError('Unable to submit report. Please login again.');
            return;
        }
        if (!formData.description.trim()) {
            setError('Description is required.');
            return;
        }
        if (!formData.location.trim()) {
            setError('Location is required.');
            return;
        }

        setSubmitting(true);
        try {
            await axios.post('http://localhost:8080/api/reports', {
                userId,
                description: formData.description,
                location: formData.location,
                imageName: formData.imageName || null,
                status: 'Pending'
            }, {
                withCredentials: true
            });

            setFormData({ description: '', location: '', imageName: '' });
            setSuccess('Report submitted successfully.');
            navigate('/dashboard');
        } catch (err) {
            const message = err.response?.data?.message || 'Failed to submit report.';
            setError(message);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="profile-page">
            <div className="profile-card report-issue-card">
                <div className="profile-top">
                    <div>
                        <h2>Report Issue</h2>
                    </div>
                    <div className="profile-top-actions">
                        <button className="profile-nav-btn" onClick={() => navigate('/profile')}>Profile</button>
                        <button className="profile-nav-btn" onClick={() => navigate('/notifications')}>Notifications</button>
                        <button className="profile-nav-btn" onClick={() => navigate('/reports')}>Report History</button>
                        <button className="profile-nav-btn danger" onClick={handleLogout}>Logout</button>
                    </div>
                </div>

                {error && <div className="error-msg">{error}</div>}
                {success && <div className="success-msg">{success}</div>}

                <form className="report-issue-form" onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Picture / Image:</label>
                        <label className="report-image-picker" htmlFor="reportImageInput">
                            <input
                                id="reportImageInput"
                                type="file"
                                accept="image/*"
                                onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    setFormData((prev) => ({ ...prev, imageName: file ? file.name : '' }));
                                }}
                            />
                            <span className="report-image-plus">+</span>
                            <span className="report-image-name">{formData.imageName || 'Add Image'}</span>
                        </label>
                    </div>

                    <div className="form-group">
                        <label>Description:</label>
                        <textarea
                            className="report-textarea"
                            required
                            value={formData.description}
                            onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                        />
                    </div>

                    <div className="form-group report-location-group">
                        <label>Location:</label>
                        <input
                            type="text"
                            required
                            value={formData.location}
                            onChange={(e) => setFormData((prev) => ({ ...prev, location: e.target.value }))}
                        />
                    </div>

                    <div className="report-submit-row">
                        <button className="btn-builder report-submit-btn" type="submit" disabled={submitting}>
                            {submitting ? 'SUBMITTING...' : 'SUBMIT REPORT'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ReportIssue;
