import { Link } from 'react-router-dom';
import '../styles/Home.css';

export default function Home() {
    return (
        <main className="home-main">
            {/* Dynamic Background Elements */}
            <div className="home-bg-1"></div>
            <div className="home-bg-2"></div>

            <div className="home-content glass">
                <h1 className="home-title">SecureVault</h1>
                <p className="home-subtitle">
                    Military-grade AES-256 cloud storage. Your files, fully encrypted, with granular role-based access control.
                </p>

                <div className="home-actions">
                    <Link to="/login" className="home-btn-primary group">
                        <span className="home-btn-primary-text">
                            Start Free Trial
                            <svg className="home-btn-icon group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                            </svg>
                        </span>
                    </Link>
                    <Link to="/register" className="home-btn-secondary">
                        Create Account
                    </Link>
                </div>

                <div className="home-features">
                    {[
                        { title: "AES-256 Encryption", desc: "Every file is encrypted locally before hitting the database." },
                        { title: "Granular RBAC", desc: "Admin, User, and Viewer roles govern every action." },
                        { title: "Zero Trust", desc: "A strict zero-trust architecture keeping external actors out." },
                    ].map((feat, i) => (
                        <div key={i} className="home-feature-card glass">
                            <h3 className="home-feature-title">{feat.title}</h3>
                            <p className="home-feature-desc">{feat.desc}</p>
                        </div>
                    ))}
                </div>
            </div>
        </main>
    );
}
