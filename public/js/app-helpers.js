// app-helpers.js — Sidebar, version checker, update popup
// Exposed as window.AppHelpers = { initSidebarLiveInfo, initVersionChecker, showUpdatePopup }
window.AppHelpers = (() => {
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
            clockElements.forEach((el) => { el.textContent = clockText; });
        };

        updateClock();
        setInterval(updateClock, 1000);

        const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Khong ro mui gio';
        const setLocationText = (text) => {
            locationElements.forEach((el) => { el.textContent = text; });
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
            () => { setLocationText(`Vi tri: ${timeZone}`); },
            { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
        );
    }

    function showUpdatePopup() {
        if (document.getElementById('update-popup')) return;

        const popup = document.createElement('div');
        popup.id = 'update-popup';
        popup.className = 'update-popup';
        popup.innerHTML = `
            <div class="update-popup-content">
                <span class="update-popup-icon">🔄</span>
                <div class="update-popup-text">
                    <strong>Phien ban moi!</strong>
                    <p>Ung dung da duoc cap nhat. Tai lai trang de su dung phien ban moi nhat.</p>
                </div>
                <div class="update-popup-actions">
                    <button class="update-btn-refresh" onclick="location.reload()">Tai lai ngay</button>
                    <button class="update-btn-dismiss" onclick="this.closest('.update-popup').remove()">De sau</button>
                </div>
            </div>
        `;
        document.body.appendChild(popup);
    }

    function initVersionChecker() {
        let currentVersion = null;

        async function checkVersion() {
            try {
                const res = await fetch('/api/version');
                if (!res.ok) return;
                const data = await res.json();

                if (currentVersion === null) {
                    currentVersion = data.version;
                } else if (data.version !== currentVersion) {
                    showUpdatePopup();
                }
            } catch (_e) {}
        }

        checkVersion();
        setInterval(checkVersion, 30 * 1000);
    }

    return { initSidebarLiveInfo, initVersionChecker, showUpdatePopup };
})();
