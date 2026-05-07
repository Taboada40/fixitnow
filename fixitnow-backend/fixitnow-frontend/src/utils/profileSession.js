import axios from 'axios';
import { useSyncExternalStore } from 'react';
import { API_BASE } from './constants';

let sessionState = null;
const sessionListeners = new Set();

const notifySessionListeners = () => {
    sessionListeners.forEach((listener) => listener());
};

const mergeMetadata = (profile = {}, existingMetadata = {}) => ({
    ...existingMetadata,
    ...(profile.firstName ? { first_name: profile.firstName } : {}),
    ...(profile.lastName ? { last_name: profile.lastName } : {}),
    ...(profile.username ? { username: profile.username } : {}),
    ...(profile.phoneNumber ? { phone_number: profile.phoneNumber } : {}),
    ...(profile.role ? { role: String(profile.role).toUpperCase() } : {})
});

const normalizeSession = (session = null) => {
    if (!session) {
        return null;
    }

    const profile = session.profile || {};
    const currentAuthSession = session.session || {};
    const accessToken = session.accessToken
        || currentAuthSession.access_token
        || currentAuthSession.accessToken
        || '';
    const refreshToken = session.refreshToken
        || currentAuthSession.refresh_token
        || currentAuthSession.refreshToken
        || '';
    const tokenType = session.tokenType
        || currentAuthSession.token_type
        || currentAuthSession.tokenType
        || 'bearer';

    return {
        ...session,
        accessToken,
        refreshToken,
        tokenType,
        session: {
            ...currentAuthSession,
            access_token: accessToken,
            accessToken,
            refresh_token: refreshToken,
            refreshToken,
            token_type: tokenType,
            user: {
                ...(currentAuthSession.user || {}),
                email: profile.email || currentAuthSession.user?.email || '',
                user_metadata: mergeMetadata(profile, currentAuthSession.user?.user_metadata || {})
            }
        },
        profile: {
            ...profile
        }
    };
};

const setSessionState = (nextSession = null) => {
    sessionState = normalizeSession(nextSession);
    notifySessionListeners();
    return sessionState;
};

const subscribe = (listener) => {
    sessionListeners.add(listener);
    return () => {
        sessionListeners.delete(listener);
    };
};

export const useSession = () => useSyncExternalStore(subscribe, () => sessionState, () => null) || null;

export const readSession = () => sessionState;

export const setSession = (session = null) => setSessionState(session);

export const clearSession = () => setSessionState(null);

export const getSupabaseAccessToken = (sessionSnapshot = null) => {
    const session = sessionSnapshot || sessionState;
    return session?.session?.access_token
        || session?.session?.accessToken
        || session?.accessToken
        || '';
};

export const getSupabaseAuthHeaders = (sessionSnapshot = null) => {
    const token = getSupabaseAccessToken(sessionSnapshot);
    return token ? { Authorization: `Bearer ${token}` } : {};
};

export const buildAuthRequestConfig = (sessionSnapshot = null) => {
    const headers = getSupabaseAuthHeaders(sessionSnapshot);
    return Object.keys(headers).length > 0
        ? { headers }
        : {};
};

const buildRequestConfig = ({ auth = true, sessionSnapshot = null, config = {} } = {}) => {
    const baseConfig = auth
        ? buildAuthRequestConfig(sessionSnapshot)
        : {};

    return {
        ...baseConfig,
        ...config,
        headers: {
            ...(baseConfig.headers || {}),
            ...(config.headers || {})
        }
    };
};

export const buildApiUrl = (path, params = {}) => {
    const url = new URL(path, API_BASE);
    Object.entries(params || {}).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
            url.searchParams.set(key, String(value));
        }
    });
    return url.toString();
};

export const apiGet = (path, { params = {}, auth = true, sessionSnapshot = null, config = {} } = {}) => {
    return axios.get(
        buildApiUrl(path, params),
        buildRequestConfig({ auth, sessionSnapshot, config })
    );
};

export const apiPost = (path, body, { params = {}, auth = true, sessionSnapshot = null, config = {} } = {}) => {
    return axios.post(
        buildApiUrl(path, params),
        body,
        buildRequestConfig({ auth, sessionSnapshot, config })
    );
};

export const apiPut = (path, body, { params = {}, auth = true, sessionSnapshot = null, config = {} } = {}) => {
    return axios.put(
        buildApiUrl(path, params),
        body,
        buildRequestConfig({ auth, sessionSnapshot, config })
    );
};

export const apiDelete = (path, { params = {}, auth = true, sessionSnapshot = null, config = {} } = {}) => {
    return axios.delete(
        buildApiUrl(path, params),
        buildRequestConfig({ auth, sessionSnapshot, config })
    );
};

export const mergeSessionProfile = (profile) => {
    const snapshot = sessionState || {};
    const mergedSession = setSessionState({
        ...snapshot,
        profile: {
            ...(snapshot.profile || {}),
            ...(profile || {})
        }
    });

    return mergedSession;
};

export const resolveSessionProfileId = () => {
    const session = sessionState;
    return session?.profile?.id || null;
};

export const resolveSessionProfileIdentifier = () => {
    const session = sessionState;
    return session?.profile?.email || session?.session?.user?.email || null;
};

export const setSessionProfile = (profile) => {
    const snapshot = sessionState || {};
    return setSessionState({
        ...snapshot,
        profile: {
            ...(snapshot.profile || {}),
            ...(profile || {})
        }
    });
};

export const fetchProfileById = async (userId, sessionSnapshot = null) => {
    if (!userId) {
        throw new Error('Authenticated profile ID is missing.');
    }

    const response = await apiGet('/api/profile/by-id', {
        params: { userId, _ts: Date.now() },
        sessionSnapshot
    });
    return response?.data || {};
};

export const fetchProfileByIdentifier = async (identifier, sessionSnapshot = null) => {
    const resolved = (identifier || '').trim();
    if (!resolved) {
        throw new Error('Profile identifier is required.');
    }

    const response = await apiGet('/api/profile/authenticated', {
        params: { identifier: resolved, _ts: Date.now() },
        sessionSnapshot
    });
    return response?.data || {};
};

export const fetchLatestSessionProfile = async ({ profileId, identifier, sessionSnapshot }) => {
    const hasId = profileId !== undefined && profileId !== null && String(profileId).trim() !== '';
    const hasIdentifier = (identifier || '').trim() !== '';

    if (hasId) {
        try {
            const byId = await fetchProfileById(profileId, sessionSnapshot);
            if (byId?.id || byId?.email) {
                return byId;
            }
        } catch (idError) {
            if (!hasIdentifier) {
                throw idError;
            }
        }
    }

    if (hasIdentifier) {
        return fetchProfileByIdentifier(identifier, sessionSnapshot);
    }

    throw new Error('Unable to resolve profile identity for latest profile fetch.');
};
