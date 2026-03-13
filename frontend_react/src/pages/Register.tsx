import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { API_URL } from '../lib/api';
import '../styles/Register.css';

export default function Register() {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState('user');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const res = await fetch(`${API_URL}/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, password, role })
            });

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.detail || 'Registration failed');
            }

            navigate('/login');
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="register-main">
            <div className="register-card glass">
                <div className="register-bg-1"></div>
                <div className="register-bg-2"></div>

                <h2 className="register-title">
                    Join SecureVault
                </h2>

                {error && <div className="register-error">{error}</div>}

                <form onSubmit={handleRegister} className="register-form">
                    <div className="register-input-group">
                        <label className="register-label">Full Name</label>
                        <input
                            required
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="register-input"
                            placeholder="John Doe"
                        />
                    </div>
                    <div className="register-input-group">
                        <label className="register-label">Email</label>
                        <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="register-input"
                            placeholder="john@example.com"
                        />
                    </div>
                    <div className="register-input-group">
                        <label className="register-label">Password</label>
                        <input
                            type="password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="register-input"
                            placeholder="••••••••"
                        />
                    </div>
                    <div className="register-input-group">
                        <label className="register-label">Role (User/Viewer)</label>
                        <select
                            value={role}
                            onChange={(e) => setRole(e.target.value)}
                            className="register-select"
                        >
                            <option value="user">User</option>
                            <option value="viewer">Viewer</option>
                        </select>
                    </div>
                    <button
                        type="submit"
                        disabled={loading}
                        className="register-submit-btn"
                    >
                        {loading ? 'Creating Account...' : 'Sign Up'}
                    </button>
                </form>

                <p className="register-footer">
                    Already have an account? <Link to="/login" className="register-link">Log in</Link>
                </p>
            </div>
        </main>
    );
}
