export const API_BASE = 'http://localhost:8080';

export const STATUS_OPTIONS = ['Pending', 'In-Progress', 'Fixed', 'Cancelled'];

export const STATUS_COLORS = {
    'In-Progress': '#FFCC00',
    'Pending': '#aaaaaa',
    'Fixed': '#4ade80',
    'Cancelled': '#ff8a8a',
};

export const DEFAULT_ADMIN_EMAIL = 'admin@cit.edu';

export const getErrorMessage = (err, fallback) => {
    let raw = err?.response?.data;
    if (typeof raw === 'string') {
        try {
            raw = JSON.parse(raw);
        } catch (_) {
            return raw || fallback;
        }
    }
    if (raw && typeof raw === 'object') {
        return raw.message || raw.error_description || raw.error || fallback;
    }
    return fallback;
};

export const normalizeStatus = (value) => {
    if (!value) {
        return 'Pending';
    }
    const match = STATUS_OPTIONS.find((option) => option.toLowerCase() === String(value).toLowerCase());
    return match || 'Pending';
};

export const normalizeEmail = (value) => {
    const input = (value || '').trim().toLowerCase();
    if (!input) {
        return '';
    }
    return input.includes('@') ? input : `${input}@project.local`;
};
