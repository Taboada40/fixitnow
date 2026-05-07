import { useCallback, useRef } from 'react';
import { useSession } from '../utils/profileSession';

/**
 * Custom hook for handling API calls with consistent error handling and loading states
 * Prevents race conditions and duplicate requests
 */
export const useApi = () => {
    const session = useSession();
    const pendingRequests = useRef(new Map());

    const makeRequest = useCallback(async (key, requestFn) => {
        // Cancel existing request with same key
        if (pendingRequests.current.has(key)) {
            pendingRequests.current.get(key).abort();
        }

        // Create new abort controller
        const controller = new AbortController();
        pendingRequests.current.set(key, controller);

        try {
            const result = await requestFn(controller.signal);
            return result;
        } catch (error) {
            if (error.name === 'AbortError') {
                console.log(`Request ${key} was aborted`);
                return null;
            }
            throw error;
        } finally {
            pendingRequests.current.delete(key);
        }
    }, []);

    const cancelRequest = useCallback((key) => {
        if (pendingRequests.current.has(key)) {
            pendingRequests.current.get(key).abort();
            pendingRequests.current.delete(key);
        }
    }, []);

    const cancelAllRequests = useCallback(() => {
        pendingRequests.current.forEach(controller => controller.abort());
        pendingRequests.current.clear();
    }, []);

    return {
        makeRequest,
        cancelRequest,
        cancelAllRequests,
        isAuthenticated: !!session
    };
};
