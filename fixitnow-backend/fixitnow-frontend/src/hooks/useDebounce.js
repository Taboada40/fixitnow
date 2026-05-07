import { useCallback, useRef } from 'react';

/**
 * Custom hook for debouncing values
 * Prevents excessive API calls during rapid user input
 */
export const useDebounce = () => {
    const timeoutRefs = useRef(new Map());

    const debounce = useCallback((key, callback, delay = 300) => {
        // Clear existing timeout for this key
        if (timeoutRefs.current.has(key)) {
            clearTimeout(timeoutRefs.current.get(key));
        }

        // Set new timeout
        const timeoutId = setTimeout(() => {
            callback();
            timeoutRefs.current.delete(key);
        }, delay);

        timeoutRefs.current.set(key, timeoutId);
    }, []);

    const clearDebounce = useCallback((key) => {
        if (timeoutRefs.current.has(key)) {
            clearTimeout(timeoutRefs.current.get(key));
            timeoutRefs.current.delete(key);
        }
    }, []);

    const clearAllDebounces = useCallback(() => {
        timeoutRefs.current.forEach(timeoutId => clearTimeout(timeoutId));
        timeoutRefs.current.clear();
    }, []);

    return {
        debounce,
        clearDebounce,
        clearAllDebounces
    };
};
