(function () {
    const runtimeConfig = window.__APP_CONFIG__ || {};
    const configuredBase =
        typeof runtimeConfig.apiBaseUrl === 'string' ? runtimeConfig.apiBaseUrl.trim().replace(/\/+$/, '') : '';
    const currentOrigin = window.location.origin;
    const isLocalPage = ['localhost', '127.0.0.1'].includes(window.location.hostname);
    const originalFetch = window.fetch.bind(window);

    function resolveOrigin(value) {
        if (!value) {
            return '';
        }

        try {
            return new URL(value, window.location.href).origin;
        } catch (_err) {
            return '';
        }
    }

    const configuredOrigin = resolveOrigin(configuredBase);
    // Removed shouldPreferSameOrigin to allow localhost testing against VPS
    const API_BASE = configuredBase;

    function isAbsoluteUrl(value) {
        return /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(value) || value.startsWith('//');
    }

    function buildApiUrl(path) {
        const normalizedPath = String(path || '');
        if (!API_BASE || !normalizedPath) {
            return normalizedPath;
        }
        if (isAbsoluteUrl(normalizedPath)) {
            return normalizedPath;
        }
        if (normalizedPath.startsWith('/')) {
            return `${API_BASE}${normalizedPath}`;
        }
        return `${API_BASE}/${normalizedPath.replace(/^\.?\//, '')}`;
    }

    window.API_BASE = API_BASE;
    window.buildApiUrl = buildApiUrl;
    window.fetch = (resource, options) => {
        const nextOptions = options ? { ...options } : {};
        if (nextOptions.credentials === undefined) {
            nextOptions.credentials = 'include';
        }

        if (typeof resource === 'string') {
            return originalFetch(buildApiUrl(resource), nextOptions);
        }

        return originalFetch(resource, nextOptions);
    };

    window.BEHAVIOR_MAP = {
        standing: 'Standing',
        lying: 'Lying',
        eating: 'Eating',
        drinking: 'Drinking',
        walking: 'Walking',
        abnormal: 'Abnormal',
    };
})();
