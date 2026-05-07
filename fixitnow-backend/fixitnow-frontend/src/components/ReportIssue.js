import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getErrorMessage } from '../utils/constants';
import { apiPost, useSession } from '../utils/profileSession';

const ReportIssue = () => {
    const navigate = useNavigate();
    const session = useSession();
    const profile = session?.profile || {};
    const role = (profile?.role || 'STUDENT').toUpperCase();
    const userId = profile?.id;

    const [formData, setFormData] = useState({
        description: '',
        location: '',
        imageName: ''
    });
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (!session) {
            navigate('/login');
            return;
        }
        if (role === 'ADMIN') {
            navigate('/admin/dashboard');
        }
    }, [session, navigate, role]);

    if (!session) {
        return null;
    }

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
            await apiPost('/api/reports', {
                userId,
                description: formData.description,
                location: formData.location,
                imageName: formData.imageName || null,
                status: 'Pending'
            });

            setFormData({ description: '', location: '', imageName: '' });
            setSuccess('Report submitted successfully.');
            navigate('/dashboard');
        } catch (err) {
            const message = getErrorMessage(err, 'Failed to submit report.');
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
                        <h2 className="ui-page-title">Report Issue</h2>
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
                            className="report-textarea ui-textarea"
                            required
                            value={formData.description}
                            onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                        />
                    </div>

                    <div className="form-group report-location-group">
                        <label>Location:</label>
                        <input
                            className="ui-input"
                            type="text"
                            required
                            value={formData.location}
                            onChange={(e) => setFormData((prev) => ({ ...prev, location: e.target.value }))}
                        />
                    </div>

                    <div className="report-submit-row">
                        <button className="report-submit-btn ui-button ui-button--primary" type="submit" disabled={submitting}>
                            {submitting ? 'SUBMITTING...' : 'SUBMIT REPORT'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ReportIssue;
