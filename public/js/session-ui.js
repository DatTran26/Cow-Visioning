// session-ui.js — Session DOM manipulation
// Depends on: AppSession being available (session.js loads before app.js)
// Exposed as window.SessionUI = { applyAuthUi, setVisibility, markSessionReady }
window.SessionUI = (() => {
    function setVisibility(element, shouldShow, displayValue = '') {
        if (!element) return;
        element.hidden = !shouldShow;
        element.style.display = shouldShow ? displayValue : 'none';
    }

    function markSessionReady() {
        document.body.classList.remove('app-session-pending');
        document.body.classList.add('app-session-ready');
    }

    function applyAuthUi(currentUser, getLoginUrl, getRegisterUrl) {
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

        const isAuthenticated = Boolean(currentUser);
        const isAdmin = currentUser?.role === 'admin';

        document.body.classList.toggle('app-authenticated', isAuthenticated);
        document.body.classList.toggle('app-guest', !isAuthenticated);

        if (loginBtn) {
            loginBtn.href = getLoginUrl();
            setVisibility(loginBtn, !isAuthenticated, 'inline-flex');
        }
        if (registerBtn) {
            registerBtn.href = getRegisterUrl();
            setVisibility(registerBtn, !isAuthenticated, 'inline-flex');
        }
        if (logoutBtn) setVisibility(logoutBtn, isAuthenticated, 'inline-flex');

        if (userBadge) {
            userBadge.textContent = isAuthenticated ? `Hello, ${currentUser.username}` : '';
            setVisibility(userBadge, isAuthenticated, 'inline-flex');
        }

        if (primaryAction && secondaryAction && ctaTitle && ctaCopy && ctaNote) {
            if (isAuthenticated) {
                ctaTitle.textContent = 'Your Account is Ready';
                ctaCopy.textContent = 'You can now access the image collection hub, use live camera capture, browse your data library, and access the admin panel if you have the required permissions.';
                ctaNote.textContent = 'Session is active. The system will maintain your user state as you switch between workspaces.';
                primaryAction.textContent = 'Open Image Collection';
                primaryAction.href = '/?tab=thu-thap';
                secondaryAction.textContent = 'Open Data Library';
                secondaryAction.href = '/?tab=gallery';
            } else {
                ctaTitle.textContent = 'Build the Dataset Together';
                ctaCopy.textContent = 'Sign in to track your contribution history, get credited, and join the community. You can still try the AI image collection anonymously if you prefer.';
                ctaNote.textContent = 'Anonymous images are shared into the community library.';
                primaryAction.textContent = 'Try Upload (Guest)';
                primaryAction.href = '/?tab=thu-thap';
                secondaryAction.textContent = 'Open Library (Guest)';
                secondaryAction.href = '/?tab=gallery';
            }
        }

        setVisibility(adminNav, isAdmin, '');
        setVisibility(adminNavSep, isAdmin, '');
        markSessionReady();
    }

    return { applyAuthUi, setVisibility, markSessionReady };
})();
