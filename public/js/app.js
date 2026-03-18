document.addEventListener('DOMContentLoaded', () => {
    initSidebarLiveInfo();

    const navItems = document.querySelectorAll('.nav-item');
    const tabs = document.querySelectorAll('.tab-content');

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const tabName = item.dataset.tab;

            navItems.forEach(n => n.classList.remove('active'));
            item.classList.add('active');

            tabs.forEach(t => t.classList.remove('active'));
            document.getElementById(`tab-${tabName}`).classList.add('active');

            if (tabName === 'gallery') {
                Gallery.loadGallery();
            }

            if (tabName === 'camera' && typeof Camera.startCamera === 'function') {
                Camera.startCamera();
            }

            if (tabName !== 'camera' && typeof Camera.stopCamera === 'function') {
                Camera.stopCamera();
            }
        });
    });

    // Initialize modules
    Upload.init();
    Camera.init();
    Gallery.init();
    Export.init();

    // Logout handler
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            try {
                await fetch('/auth/logout', { method: 'POST' });
            } catch (e) {}
            window.location.href = '/auth/login';
        });
    }

    // Global 401 handler - redirect to login if session expired
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
        const response = await originalFetch(...args);
        if (response.status === 401 && !args[0].toString().includes('/auth/')) {
            window.location.href = '/auth/login';
        }
        return response;
    };
});

function initSidebarLiveInfo() {
    const clockElements = [
        document.getElementById('sidebar-clock'),
        document.getElementById('mobile-main-clock'),
    ].filter(Boolean);
    const locationElements = [
        document.getElementById('sidebar-location'),
        document.getElementById('mobile-main-location'),
    ].filter(Boolean);

    if (clockElements.length === 0 || locationElements.length === 0) return;

    const updateClock = () => {
        const now = new Date();
        const dayNames = ['Chu Nhat', 'Thu 2', 'Thu 3', 'Thu 4', 'Thu 5', 'Thu 6', 'Thu 7'];
        const hh = String(now.getHours()).padStart(2, '0');
        const mm = String(now.getMinutes()).padStart(2, '0');
        const ss = String(now.getSeconds()).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');
        const mo = String(now.getMonth() + 1).padStart(2, '0');
        const yy = now.getFullYear();

        const clockText = `${hh}:${mm}:${ss} ${dayNames[now.getDay()]}, ${dd}/${mo}/${yy}`;
        clockElements.forEach(el => {
            el.textContent = clockText;
        });
    };

    updateClock();
    setInterval(updateClock, 1000);

    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Khong ro mui gio';

    const setLocationText = (text) => {
        locationElements.forEach(el => {
            el.textContent = text;
        });
    };

    if (!navigator.geolocation) {
        setLocationText(`Vi tri: ${timeZone}`);
        return;
    }

    navigator.geolocation.getCurrentPosition(
        ({ coords }) => {
            const lat = coords.latitude.toFixed(5);
            const lng = coords.longitude.toFixed(5);
            setLocationText(`Vi tri: ${lat}, ${lng}`);
        },
        () => {
            setLocationText(`Vi tri: ${timeZone}`);
        },
        {
            enableHighAccuracy: false,
            timeout: 8000,
            maximumAge: 300000,
        }
    );
}
