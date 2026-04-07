// app.js — App entry point: tab routing, module init, logout, global handlers
// Depends on: AppHelpers, AppSession, and all module globals
document.addEventListener('DOMContentLoaded', () => {
    if (typeof AppHelpers !== 'undefined') {
        AppHelpers.initSidebarLiveInfo();
        AppHelpers.initVersionChecker();
    }

    const navItems = document.querySelectorAll('.nav-item');
    const tabs = document.querySelectorAll('.tab-content');

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const tabName = item.dataset.tab;

            const ripple = document.createElement('span');
            Object.assign(ripple.style, {
                position: 'absolute', width: '100px', height: '100px',
                background: 'rgba(255, 255, 255, 0.2)', borderRadius: '50%',
                transform: 'scale(0)', animation: 'ripple 0.6s linear',
                pointerEvents: 'none', left: '50%', top: '50%',
                marginLeft: '-50px', marginTop: '-50px',
            });
            item.style.position = 'relative';
            item.style.overflow = 'hidden';
            item.appendChild(ripple);
            setTimeout(() => ripple.remove(), 600);

            navItems.forEach(n => n.classList.remove('active'));
            item.classList.add('active');

            const targetTab = document.getElementById(`tab-${tabName}`);
            tabs.forEach(t => {
                t.classList.remove('active');
                t.style.opacity = '0';
                t.style.transform = 'translateY(10px)';
            });

            if (targetTab) {
                targetTab.classList.add('active');
                setTimeout(() => {
                    targetTab.style.transition = 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)';
                    targetTab.style.opacity = '1';
                    targetTab.style.transform = 'translateY(0)';
                }, 10);
            }

            if (tabName === 'gallery') Gallery.loadGallery();
            if (tabName === 'camera' && typeof Camera.startCamera === 'function') Camera.startCamera();
            if (tabName !== 'camera' && typeof Camera.stopCamera === 'function') Camera.stopCamera();
        });
    });

    // Initialize modules
    if (typeof Upload !== 'undefined') Upload.init();
    if (typeof Camera !== 'undefined') Camera.init();
    if (typeof Gallery !== 'undefined') Gallery.init();
    if (typeof Export !== 'undefined') Export.init();
    if (typeof Settings !== 'undefined') Settings.init();

    // Logout handler
    document.getElementById('logout-btn')?.addEventListener('click', async () => {
        try { await fetch('/auth/logout', { method: 'POST' }); } catch (_e) {}
        window.location.href = '/auth/login';
    });

    // Global 401 redirect
    const _origFetch = window.fetch;
    window.fetch = async (...args) => {
        const res = await _origFetch(...args);
        if (res.status === 401 && !args[0].toString().includes('/auth/')) {
            window.location.href = '/auth/login';
        }
        return res;
    };
});
