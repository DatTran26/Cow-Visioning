// session.js — Auth state management, fetch wrapper, requireAuth
// Extracted to session-ui.js: applyAuthUi, setVisibility, markSessionReady
// Exposed as window.AppSession
const AppSession = (() => {
    let currentUser = null;
    let initPromise = null;
    let baseFetch = null;

    function sanitizeNext(nextValue) {
        if (typeof nextValue !== 'string') return null;
        const trimmed = nextValue.trim();
        if (!trimmed.startsWith('/') || trimmed.startsWith('//')) return null;
        return trimmed;
    }

    function currentPath() {
        return `${window.location.pathname}${window.location.search}`;
    }

    function getLoginUrl(nextPath) {
        const safeNext = sanitizeNext(nextPath) || currentPath();
        return `/auth/login?next=${encodeURIComponent(safeNext)}`;
    }

    function getRegisterUrl(nextPath) {
        const safeNext = sanitizeNext(nextPath) || currentPath();
        return `/auth/register?next=${encodeURIComponent(safeNext)}`;
    }

    function dispatchChange() {
        document.dispatchEvent(
            new CustomEvent('app:session-changed', {
                detail: { user: currentUser },
            })
        );
    }

    async function fetchCurrentUser() {
        const fetchImpl = baseFetch || window.fetch.bind(window);
        try {
            const response = await fetchImpl('/auth/me', {
                headers: { Accept: 'application/json' },
            });
            if (!response.ok) return null;
            const payload = await response.json();
            return payload?.user || null;
        } catch (_err) {
            return null;
        }
    }

    async function refresh() {
        currentUser = await fetchCurrentUser();
        if (typeof SessionUI !== 'undefined') {
            SessionUI.applyAuthUi(currentUser, getLoginUrl, getRegisterUrl);
        }
        dispatchChange();
        return currentUser;
    }

    function wrapFetch() {
        if (baseFetch) return;
        baseFetch = window.fetch.bind(window);
        window.__appOriginalFetch = baseFetch;

        window.fetch = async (...args) => {
            const response = await baseFetch(...args);
            const target = String(args[0] || '');
            if (response.status === 401 && !target.includes('/auth/')) {
                window.location.href = getLoginUrl();
            }
            return response;
        };
    }

    function requireAuth(tabName) {
        if (currentUser) return true;
        if (['thu-thap', 'gallery', 'blog', 'home'].includes(tabName)) return true;

        const url = new URL(window.location.href);
        if (tabName && tabName !== 'home') {
            url.searchParams.set('tab', tabName);
        } else {
            url.searchParams.delete('tab');
        }
        window.location.href = getLoginUrl(`${url.pathname}${url.search}`);
        return false;
    }

    function init() {
        if (!initPromise) {
            wrapFetch();
            initPromise = refresh();
        }
        return initPromise;
    }

    return {
        getCurrentUser: () => currentUser,
        getLoginUrl,
        init,
        isAdmin: () => currentUser?.role === 'admin',
        isAuthenticated: () => Boolean(currentUser),
        refresh,
        requireAuth,
    };
})();

window.AppSession = AppSession;

