import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';

const Register = () => {
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        username: '',
        phoneNumber: '',
        email: '',
        password: '',
        confirmPassword: ''
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const normalizeEmail = (value) => {
        const input = (value || '').trim().toLowerCase();
        if (!input) {
            return '';
        }
        return input.includes('@') ? input : `${input}@project.local`;
    };

    const handleRegister = async (e) => {
        e.preventDefault();
        setError('');

        const normalizedEmail = normalizeEmail(formData.email);
        if (!normalizedEmail) {
            setError('Please enter an email or login ID.');
            return;
        }
        if (formData.password.length < 6) {
            setError('Password must be at least 6 characters.');
            return;
        }
        if (formData.password !== formData.confirmPassword) {
            setError('Passwords do not match.');
            return;
        }

        setLoading(true);
        try {
            await axios.post('http://localhost:8080/api/auth/register', {
                firstName: formData.firstName,
                lastName: formData.lastName,
                username: formData.username,
                phoneNumber: formData.phoneNumber,
                email: normalizedEmail,
                password: formData.password
            }, { withCredentials: true });
            alert('Account created successfully. You can now log in.');
            navigate('/login');
        } catch (err) {
            const msg = err.response?.data?.message || err.response?.data || err.message;
            if (typeof msg === 'string' && msg.includes('already registered')) {
                setError('An account with this email already exists.');
            } else {
                setError('Registration failed. Please try again.');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-page">
            <Link to="/login" className="back-arrow" aria-label="Back to login">&lsaquo;</Link>
            <div className="auth-card">
                <div className="auth-header"><h2>Create my account</h2></div>
                <div className="auth-body">
                    {error && <div className="error-msg">{error}</div>}
                    <form onSubmit={handleRegister}>
                        <div className="form-row">
                            <div className="form-group">
                                <label>First Name</label>
                                <input type="text" required placeholder=""
                                    value={formData.firstName}
                                    onChange={e => setFormData({...formData, firstName: e.target.value})} />
                            </div>
                            <div className="form-group">
                                <label>Last Name</label>
                                <input type="text" required placeholder=""
                                    value={formData.lastName}
                                    onChange={e => setFormData({...formData, lastName: e.target.value})} />
                            </div>
                        </div>
                        <div className="form-group">
                            <label>Username</label>
                            <input type="text" required placeholder=""
                                value={formData.username}
                                onChange={e => setFormData({...formData, username: e.target.value})} />
                        </div>
                        <div className="form-group">
                            <label>Phone Number</label>
                            <input type="text" placeholder=""
                                value={formData.phoneNumber}
                                onChange={e => setFormData({...formData, phoneNumber: e.target.value})} />
                        </div>
                        <div className="form-group">
                            <label>Email Address</label>
                            <input type="text" required placeholder=""
                                value={formData.email}
                                onChange={e => setFormData({...formData, email: e.target.value})} />
                        </div>
                        <div className="form-group">
                            <label>Password</label>
                            <input type="password" required placeholder=""
                                value={formData.password}
                                onChange={e => setFormData({...formData, password: e.target.value})} />
                        </div>
                        <div className="form-group">
                            <label>Confirm password</label>
                            <input type="password" required placeholder=""
                                value={formData.confirmPassword}
                                onChange={e => setFormData({...formData, confirmPassword: e.target.value})} />
                        </div>
                        <button className="btn-builder" disabled={loading}>
                            {loading ? 'Creating account...' : 'Sign up'}
                        </button>
                    </form>
                    <div className="auth-footer">
                        Already have an account? <Link to="/login" className="auth-link">Log in</Link>
                    </div>
                </div>
            </div>
        </div>
    );
};
export default Register;