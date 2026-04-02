const AppSession = (() => {
    let currentUser = null;
    let initPromise = null;
    let originalFetch = null;

    function sanitizeNext(nextValue) {
        if (typeof nextValue !== 'string') {
            return null;
        }

        const trimmed = nextValue.trim();
        if (!trimmed.startsWith('/') || trimmed.startsWith('//')) {
            return null;
        }

        return trimmed;
    }

    function getLoginUrl(nextPath) {
        const safeNext = sanitizeNext(nextPath) || `${window.location.pathname}${window.location.search}`;
        return `/auth/login?next=${encodeURIComponent(safeNext)}`;
    }

    function getRegisterUrl(nextPath) {
        const safeNext = sanitizeNext(nextPath) || `${window.location.pathname}${window.location.search}`;
        return `/auth/register?next=${encodeURIComponent(safeNext)}`;
    }

    function dispatchChange() {
        document.dispatchEvent(
            new CustomEvent('app:session-changed', {
                detail: { user: currentUser },
            })
        );
    }

    function applyAuthUi() {
        const loginBtn = document.getElementById('login-btn');
        const registerBtn = document.getElementById('register-btn');
        const logoutBtn = document.getElementById('logout-btn');
        const userBadge = document.getElementById('topnav-user');
        const primaryAction = document.getElementById('home-primary-action');
        const secondaryAction = document.getElementById('home-secondary-action');
        const ctaTitle = document.getElementById('home-cta-title');
        const ctaCopy = document.getElementById('home-cta-copy');
        const ctaNote = document.getElementById('home-cta-note');
        const adminNav = document.getElementById('admin-nav');
        const adminNavSep = document.getElementById('admin-nav-sep');
        const exportNav = document.getElementById('export-nav');
        const exportNavSep = document.getElementById('export-nav-sep');

        const isAuthenticated = Boolean(currentUser);
        const isAdmin = currentUser?.role === 'admin';

        document.body.classList.toggle('app-authenticated', isAuthenticated);
        document.body.classList.toggle('app-guest', !isAuthenticated);

        if (loginBtn) {
            loginBtn.hidden = isAuthenticated;
            loginBtn.href = getLoginUrl();
        }

        if (registerBtn) {
            registerBtn.hidden = isAuthenticated;
            registerBtn.href = getRegisterUrl();
        }

        if (logoutBtn) {
            logoutBtn.hidden = !isAuthenticated;
        }

        if (userBadge) {
            userBadge.hidden = !isAuthenticated;
            userBadge.textContent = isAuthenticated ? `Xin chao, ${currentUser.username}` : '';
        }

        if (primaryAction && secondaryAction && ctaTitle && ctaCopy && ctaNote) {
            if (isAuthenticated) {
                ctaTitle.textContent = 'San sang thu thap va dong bo du lieu';
                ctaCopy.textContent =
                    'Tai khoan cua ban da san sang. Mo khu thu thap, xem thu vien anh, blog va xuat du lieu tu mot dashboard thong nhat.';
                ctaNote.textContent =
                    'AI settings, upload, camera, gallery, blog va export da duoc lien ket tren cung mot trang.';
                primaryAction.textContent = 'Mo khu thu thap';
                primaryAction.href = '/?tab=thu-thap';
                secondaryAction.textContent = 'Mo thu vien du lieu';
                secondaryAction.href = '/?tab=gallery';
            } else {
                ctaTitle.textContent = 'Bat dau voi tai khoan that';
                ctaCopy.textContent =
                    'Dang nhap hoac tao tai khoan de su dung day du upload, camera, gallery, blog, export va quan tri AI trong mot he thong dong nhat.';
                ctaNote.textContent =
                    'Neu chua dang nhap, cac tab nghiep vu se dua ban toi trang xac thuc truoc khi su dung.';
                primaryAction.textContent = 'Dang nhap de su dung';
                primaryAction.href = getLoginUrl('/?tab=thu-thap');
                secondaryAction.textContent = 'Tao tai khoan moi';
                secondaryAction.href = getRegisterUrl('/?tab=thu-thap');
            }
        }

        if (adminNav) {
            adminNav.style.display = isAdmin ? '' : 'none';
        }

        if (adminNavSep) {
            adminNavSep.style.display = isAdmin ? '' : 'none';
        }

        if (exportNav) {
            exportNav.style.display = '';
        }

        if (exportNavSep) {
            exportNavSep.style.display = '';
        }
    }

    async function refresh() {
        const fetchImpl = originalFetch || window.fetch.bind(window);

        try {
            const response = await fetchImpl('/auth/me', {
                headers: { Accept: 'application/json' },
            });

            if (!response.ok) {
                currentUser = null;
                applyAuthUi();
                dispatchChange();
                return currentUser;
            }

            const payload = await response.json();
            currentUser = payload?.user || null;
        } catch (_err) {
            currentUser = null;
        }

        applyAuthUi();
        dispatchChange();
        return currentUser;
    }

    function wrapFetch() {
        if (originalFetch) {
            return;
        }

        originalFetch = window.fetch.bind(window);
        window.__appOriginalFetch = originalFetch;

        window.fetch = async (...args) => {
            const response = await originalFetch(...args);
            const target = String(args[0] || '');

            if (response.status === 401 && !target.includes('/auth/')) {
                window.location.href = getLoginUrl();
            }

            return response;
        };
    }

    function requireAuth(tabName) {
        if (currentUser) {
            return true;
        }

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
