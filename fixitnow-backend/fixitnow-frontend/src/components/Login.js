import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';

const Login = () => {
    const [creds, setCreds] = useState({ email: '', password: '' });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const normalizeIdentifier = (value) => {
        const input = (value || '').trim().toLowerCase();
        return input;
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');

        const identifier = normalizeIdentifier(creds.email);
        if (!identifier) {
            setError('Please enter your email.');
            return;
        }
        if (creds.password.length < 6) {
            setError('Password must be at least 6 characters.');
            return;
        }

        setLoading(true);
        try {
            const res = await axios.post('http://localhost:8080/api/auth/login', {
                ...creds,
                email: identifier
            }, {
                withCredentials: true
            });
            localStorage.setItem('session', JSON.stringify(res.data));
            const role = (res.data?.profile?.role || 'STUDENT').toUpperCase();
            if (role === 'ADMIN') {
                navigate('/admin/dashboard');
            } else {
                navigate('/dashboard');
            }
        } catch (err) {
            console.error('Login Error:', err);
            if (!err.response) {
                setError('Cannot reach server. Please make sure backend is running on port 8080.');
                return;
            }
            // Parse the real error from Supabase passed through the backend
            let raw = err.response?.data;
            if (typeof raw === 'string') {
                try { raw = JSON.parse(raw); } catch (_) { /* keep as string */ }
            }
            const msg = (typeof raw === 'object' ? (raw?.error_description || raw?.error_code || raw?.message) : raw) || '';
            const low = msg.toLowerCase();
            if (low.includes('email not confirmed')) {
                setError('Please verify your email first, then try logging in again.');
            } else if (low.includes('invalid login credentials') || low.includes('invalid')) {
                setError('Incorrect email or password. Please try again.');
            } else {
                setError(msg || 'Login failed. Please try again.');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-page">
            <div className="auth-card">
                <div className="auth-header">
                    <span className="brand-title">FixItNow</span>
                    <h2>Login</h2>
                </div>
                <div className="auth-body">
                    {error && <div className="error-msg">{error}</div>}
                    <form onSubmit={handleLogin}>
                        <div className="form-group">
                            <label>Email</label>
                            <input
                                type="text"
                                required
                                value={creds.email}
                                onChange={e => setCreds({...creds, email: e.target.value})}
                            />
                        </div>
                        <div className="form-group">
                            <label>Password</label>
                            <input
                                type="password"
                                required
                                value={creds.password}
                                onChange={e => setCreds({...creds, password: e.target.value})}
                            />
                        </div>
                        <div className="forgot-password">
                            <span>Forgot password?</span>
                        </div>
                        <button type="submit" className="btn-builder" disabled={loading}>
                            {loading ? 'Logging in...' : 'Log in'}
                        </button>
                    </form>
                    <div className="auth-footer">
                        Don't have an account? <Link to="/register" className="auth-link">Sign up</Link>
                    </div>
                </div>
            </div>
        </div>
    );
};
export default Login;