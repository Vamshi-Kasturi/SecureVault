export const API_URL = 'https://securevault-backend-cthk.onrender.com/api';

export const fetchAPI = async (endpoint, options = {}) => {
    const token = localStorage.getItem('token');
    const headers = new Headers(options.headers || {});
    if (token) {
        headers.set('Authorization', `Bearer ${token}`);
    }
    const config = {
        ...options,
        headers,
    };
    const res = await fetch(`${API_URL}${endpoint}`, config);
    if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || 'API request failed');
    }
    return res.json();
};
