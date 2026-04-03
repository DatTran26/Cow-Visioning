(function () {
    const runtimeConfig = window.__APP_CONFIG__ || {};
    const configuredBase = typeof runtimeConfig.apiBaseUrl === 'string'
        ? runtimeConfig.apiBaseUrl.trim().replace(/\/+$/, '')
        : '';
    const originalFetch = window.fetch.bind(window);
    var API_BASE = configuredBase;

    function isAbsoluteUrl(value) {
        return /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(value) || value.startsWith('//');
    }

    function buildApiUrl(path) {
        const normalizedPath = String(path || '');
        if (!configuredBase || !normalizedPath) {
            return normalizedPath;
        }
        if (isAbsoluteUrl(normalizedPath)) {
            return normalizedPath;
        }
        if (normalizedPath.startsWith('/')) {
            return `${configuredBase}${normalizedPath}`;
        }
        return `${configuredBase}/${normalizedPath.replace(/^\.?\//, '')}`;
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

    var BEHAVIOR_MAP = {
        standing: 'Đứng',
        lying: 'Nằm',
        eating: 'Ăn',
        drinking: 'Uống nước',
        walking: 'Đi lại',
        abnormal: 'Bất thường',
    };
    window.BEHAVIOR_MAP = BEHAVIOR_MAP;
})();
