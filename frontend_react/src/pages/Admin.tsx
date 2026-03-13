import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchAPI } from '../lib/api';
import '../styles/Admin.css';

export default function AdminPanel() {
    const [logs, setLogs] = useState<any[]>([]);
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        const userData = localStorage.getItem('user');
        if (!userData || JSON.parse(userData).role !== 'admin') {
            navigate('/dashboard');
            return;
        }
        loadData();
    }, [navigate]);

    const loadData = async () => {
        try {
            const logsData = await fetchAPI('/logs');
            setLogs(logsData);
            const usersData = await fetchAPI('/users');
            setUsers(usersData);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="admin-loading"><div className="admin-spinner"></div></div>;

    return (
        <main className="admin-main">
            <div className="admin-container">

                <header className="admin-header glass">
                    <div>
                        <h1 className="admin-title">Admin Control Center</h1>
                        <p className="admin-subtitle">Manage users and view system activity logs securely</p>
                    </div>
                    <button onClick={() => navigate('/dashboard')} className="admin-back-btn">
                        Back to Dashboard
                    </button>
                </header>

                <div className="admin-grid">
                    {/* User Management */}
                    <section className="admin-section glass">
                        <h2 className="admin-section-title">User Management</h2>
                        <div className="admin-list">
                            {users.map(u => (
                                <div key={u.user_id} className="admin-user-card">
                                    <div>
                                        <h3 className="admin-user-name">{u.name} <span className="admin-user-role">{u.role}</span></h3>
                                        <p className="admin-user-email">{u.email}</p>
                                        <p className="admin-user-id">ID: {u.user_id}</p>
                                    </div>
                                    <div className="admin-user-actions">
                                        <button className="admin-edit-btn">Edit Role</button>
                                        {u.role !== 'admin' && (
                                            <button className="admin-deactivate-btn">Deactivate</button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* System Logs */}
                    <section className="admin-section glass">
                        <h2 className="admin-section-title">Activity Logs</h2>
                        <div className="admin-list">
                            {logs.map((lg, i) => (
                                <div key={lg.log_id || i} className="admin-log-card">
                                    <div className="admin-log-icon-wrap">
                                        <svg className="admin-log-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    </div>
                                    <div className="admin-log-content">
                                        <p className="admin-log-action">{lg.action}</p>
                                        <div className="admin-log-meta">
                                            <span>{lg.user_name}</span>
                                            <span>{new Date(lg.timestamp).toLocaleString()}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {logs.length === 0 && <p className="admin-no-logs">No logs found.</p>}
                        </div>
                    </section>
                </div>
            </div>
        </main>
    );
}
