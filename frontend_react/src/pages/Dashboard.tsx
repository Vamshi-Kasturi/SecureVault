import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchAPI, API_URL } from '../lib/api';
import '../styles/Dashboard.css';

export default function Dashboard() {
    const [files, setFiles] = useState<any[]>([]);
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [uploadSuccess, setUploadSuccess] = useState(false);

    // Share modal state
    const [shareFileId, setShareFileId] = useState<string | null>(null);
    const [shareFileName, setShareFileName] = useState('');
    const [shareUserId, setShareUserId] = useState('');
    const [sharePerm, setSharePerm] = useState('view');
    const [shareLoading, setShareLoading] = useState(false);
    const [shareStatus, setShareStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

    // All users for the picker (admin only; regular users see a manual UUID input as fallback)
    const [allUsers, setAllUsers] = useState<any[]>([]);
    const [userSearch, setUserSearch] = useState('');

    const fileInputRef = useRef<HTMLInputElement>(null);
    const navigate = useNavigate();

    useEffect(() => {
        const userData = localStorage.getItem('user');
        if (!userData) {
            navigate('/login');
            return;
        }
        const parsedUser = JSON.parse(userData);
        setUser(parsedUser);
        loadFiles();
        loadUsers();
    }, [navigate]);

    const loadFiles = async () => {
        try {
            const data = await fetchAPI('/files');
            setFiles(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const loadUsers = async () => {
        try {
            const data = await fetchAPI('/users');
            setAllUsers(data);
        } catch {
            // non-admins won't have access — that's fine
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files?.[0]) return;
        setUploading(true);
        const formData = new FormData();
        formData.append('file', e.target.files[0]);

        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_URL}/upload`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData,
            });
            if (res.ok) {
                setUploadSuccess(true);
                setTimeout(() => setUploadSuccess(false), 3000);
                await loadFiles();
            }
        } catch (err) {
            console.error('Upload failed', err);
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleDownload = async (fileId: string, fileName: string) => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_URL}/download/${fileId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error('Download failed');
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            a.click();
            window.URL.revokeObjectURL(url);
        } catch {
            // silent
        }
    };

    const handleDelete = async (fileId: string) => {
        if (!window.confirm("Are you sure you want to delete this file?")) return;
        try {
            await fetchAPI(`/files/${fileId}`, {
                method: 'DELETE'
            });
            await loadFiles();
        } catch (err: any) {
            console.error('Delete failed', err);
            alert(err.message || 'Failed to delete the file.');
        }
    };

    const openShareModal = (fileId: string, fileName: string) => {
        setShareFileId(fileId);
        setShareFileName(fileName);
        setShareUserId('');
        setUserSearch('');
        setSharePerm('view');
        setShareStatus(null);
    };

    const handleShare = async () => {
        if (!shareUserId) {
            setShareStatus({ type: 'error', msg: 'Please select a user to share with.' });
            return;
        }
        setShareLoading(true);
        setShareStatus(null);
        try {
            await fetchAPI('/share', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ file_id: shareFileId, user_id: shareUserId, permission_type: sharePerm })
            });
            setShareStatus({ type: 'success', msg: 'Access granted successfully! 🎉' });
            setTimeout(() => setShareFileId(null), 1800);
        } catch (err: any) {
            setShareStatus({ type: 'error', msg: err.message || 'Share failed. Please try again.' });
        } finally {
            setShareLoading(false);
        }
    };

    const filteredUsers = allUsers.filter(u =>
        u.user_id !== user?.user_id &&
        (u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
            u.email.toLowerCase().includes(userSearch.toLowerCase()))
    );

    if (loading) return (
        <div className="dashboard-loading">
            <div className="dashboard-spinner"></div>
        </div>
    );

    return (
        <main className="dashboard-main">
            <div className="dashboard-container">

                {/* Header */}
                <header className="dashboard-header glass">
                    <div>
                        <h1 className="dashboard-title">SecureVault Dashboard</h1>
                        <p className="dashboard-subtitle">Welcome back, <span className="dashboard-user-name">{user?.name}</span> <span className="dashboard-user-role">{user?.role}</span></p>
                    </div>
                    <div className="dashboard-header-actions">
                        {user?.role === 'admin' && (
                            <button onClick={() => navigate('/admin')} className="dashboard-admin-btn">
                                Admin Panel
                            </button>
                        )}
                        <button onClick={() => { localStorage.clear(); navigate('/login'); }} className="dashboard-logout-btn">
                            Logout
                        </button>
                    </div>
                </header>

                {/* Upload Zone */}
                {user?.role !== 'viewer' && (
                    <section
                        className={`dashboard-upload-zone glass group ${uploadSuccess ? 'dashboard-upload-success' : 'dashboard-upload-default'}`}
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <input type="file" className="hidden dashboard-hidden-input" ref={fileInputRef} onChange={handleFileUpload} />
                        <div className="dashboard-upload-content">
                            {uploadSuccess ? (
                                <>
                                    <svg className="dashboard-upload-icon-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <h3 className="dashboard-upload-title-success">Encrypted & Stored!</h3>
                                    <p className="dashboard-upload-desc">Your file was encrypted with AES-256 and saved securely.</p>
                                </>
                            ) : (
                                <>
                                    <svg className={`dashboard-upload-icon ${uploading ? 'animate-bounce' : 'group-hover:scale-110 transition-transform'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                    </svg>
                                    <h3 className="dashboard-upload-title">{uploading ? 'Encrypting & Uploading...' : 'Upload File'}</h3>
                                    <p className="dashboard-upload-desc">Click to browse. Files are AES-256 encrypted before storage.</p>
                                </>
                            )}
                        </div>
                    </section>
                )}

                {/* File List */}
                <section className="dashboard-files glass">
                    <h2 className="dashboard-files-title">Your Files
                        <span className="dashboard-files-count">({files.length} file{files.length !== 1 ? 's' : ''})</span>
                    </h2>
                    {files.length === 0 ? (
                        <div className="dashboard-no-files">
                            <svg className="dashboard-no-files-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <p className="dashboard-no-files-text">No files yet. Upload your first encrypted file above.</p>
                        </div>
                    ) : (
                        <div className="dashboard-files-grid">
                            {files.map(f => (
                                <div key={f.file_id} className="dashboard-file-card group">
                                    <div className="dashboard-file-header">
                                        <div className="dashboard-file-icon-wrap">
                                            <svg className="dashboard-file-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                            </svg>
                                        </div>
                                        <div className="dashboard-file-info">
                                            <p className="dashboard-file-name" title={f.file_name}>{f.file_name}</p>
                                            <p className="dashboard-file-date">{new Date(f.upload_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                                        </div>
                                    </div>
                                    <div className="dashboard-file-actions">
                                        <button
                                            onClick={() => handleDownload(f.file_id, f.file_name)}
                                            className="dashboard-download-btn"
                                        >
                                            <svg className="dashboard-btn-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                            Download
                                        </button>
                                        {(user.role === 'admin' || f.owner_id === user.user_id) && (
                                            <button
                                                onClick={() => openShareModal(f.file_id, f.file_name)}
                                                className="dashboard-share-btn"
                                            >
                                                <svg className="dashboard-btn-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                                                Share
                                            </button>
                                        )}
                                        <button
                                            onClick={() => handleDelete(f.file_id)}
                                            className="dashboard-delete-btn"
                                            title="Delete File"
                                        >
                                            <svg className="dashboard-btn-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>

                {/* Share Modal */}
                {shareFileId && (
                    <div className="share-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShareFileId(null); }}>
                        <div className="share-modal-card glass">
                            <div className="share-modal-header">
                                <div>
                                    <h3 className="share-modal-title">Share File Access</h3>
                                    <p className="share-modal-subtitle" title={shareFileName}>📄 {shareFileName}</p>
                                </div>
                                <button onClick={() => setShareFileId(null)} className="share-modal-close">
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>

                            <div className="share-modal-body">
                                <div>
                                    <label className="share-modal-label">Select User</label>
                                    {allUsers.length > 0 ? (
                                        <div className="share-search-group">
                                            <input
                                                type="text"
                                                placeholder="Search by name or email..."
                                                value={userSearch}
                                                onChange={e => setUserSearch(e.target.value)}
                                                className="share-search-input"
                                            />
                                            <div className="share-users-list">
                                                {filteredUsers.length === 0 ? (
                                                    <p className="share-no-users">No users found.</p>
                                                ) : (
                                                    filteredUsers.map(u => (
                                                        <button
                                                            key={u.user_id}
                                                            onClick={() => setShareUserId(u.user_id)}
                                                            className={`share-user-option ${shareUserId === u.user_id ? 'share-user-option-active' : 'share-user-option-default'}`}
                                                        >
                                                            <div className={`share-user-avatar ${shareUserId === u.user_id ? 'share-user-avatar-active' : 'share-user-avatar-default'}`}>
                                                                {u.name.charAt(0).toUpperCase()}
                                                            </div>
                                                            <div className="share-user-info">
                                                                <p className="share-user-name">{u.name}</p>
                                                                <p className="share-user-email">{u.email} · <span className="capitalize">{u.role}</span></p>
                                                            </div>
                                                            {shareUserId === u.user_id && (
                                                                <svg className="share-user-check" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                                                            )}
                                                        </button>
                                                    ))
                                                )}
                                            </div>
                                        </div>
                                    ) : (
                                        <input
                                            placeholder="Paste User ID (UUID)..."
                                            value={shareUserId}
                                            onChange={e => setShareUserId(e.target.value)}
                                            className="share-id-input"
                                        />
                                    )}
                                </div>

                                <div>
                                    <label className="share-modal-label">Permission Level</label>
                                    <div className="share-perm-grid">
                                        {[
                                            { value: 'view', label: 'View & Download', icon: '👁️' },
                                            { value: 'edit', label: 'Full Edit Access', icon: '✏️' },
                                        ].map(opt => (
                                            <button
                                                key={opt.value}
                                                onClick={() => setSharePerm(opt.value)}
                                                className={`share-perm-btn ${sharePerm === opt.value ? 'share-perm-btn-active' : 'share-perm-btn-default'}`}
                                            >
                                                <span className="share-perm-icon">{opt.icon}</span>
                                                {opt.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {shareStatus && (
                                    <div className={`share-status ${shareStatus.type === 'success' ? 'share-status-success' : 'share-status-error'}`}>
                                        {shareStatus.type === 'success' ? '✓' : '⚠'} {shareStatus.msg}
                                    </div>
                                )}

                                <div className="share-modal-actions">
                                    <button onClick={() => setShareFileId(null)} className="share-btn-cancel">
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleShare}
                                        disabled={shareLoading || !shareUserId}
                                        className="share-btn-submit"
                                    >
                                        {shareLoading ? 'Sharing...' : 'Grant Access'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </main>
    );
}
