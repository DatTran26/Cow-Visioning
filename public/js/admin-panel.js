// admin-panel.js — Admin init, stats, AI settings, session sync
// Depends on: AdminUsers
// Exposes window.Admin = { init, loadPanel }
const Admin = (() => {
    let currentRole = null;

    function syncSessionState() {
        const currentUser = window.AppSession?.getCurrentUser?.() || null;
        currentRole = currentUser?.role || null;

        const adminNav = document.getElementById('admin-nav');
        const adminNavSep = document.getElementById('admin-nav-sep');
        const adminTab = document.getElementById('tab-admin');
        const showAdmin = currentRole === 'admin';

        if (adminNav) adminNav.style.display = showAdmin ? '' : 'none';
        if (adminNavSep) adminNavSep.style.display = showAdmin ? '' : 'none';
        if (adminTab) adminTab.style.display = showAdmin ? '' : 'none';
    }

    async function loadStats() {
        try {
            const res = await fetch('/admin/stats');
            const data = await res.json();
            const element = document.getElementById('admin-stats');
            if (element) {
                element.innerHTML = `
                    <div class="admin-stat-card"><div class="admin-stat-num">${data.total_users}</div><div class="admin-stat-label">Người dùng</div></div>
                    <div class="admin-stat-card"><div class="admin-stat-num">${data.total_images}</div><div class="admin-stat-label">Ảnh đã tải</div></div>
                    <div class="admin-stat-card"><div class="admin-stat-num">${data.total_posts}</div><div class="admin-stat-label">Bài viết</div></div>
                `;
            }
        } catch (error) {
            console.error('Load stats error:', error);
        }
    }

    async function loadAiSettings() {
        try {
            const res = await fetch('/admin/ai-settings');
            const result = await res.json();
            if (!res.ok) throw new Error(result.error);

            const settings = result.data;
            const confSlider = document.getElementById('admin-conf-threshold');
            const iouSlider = document.getElementById('admin-iou-threshold');
            const maxDetInput = document.getElementById('admin-max-det');
            const deviceSelect = document.getElementById('admin-ai-device');
            const enabledCheck = document.getElementById('admin-ai-enabled');

            if (confSlider) {
                confSlider.value = settings.AI_CONF_THRESHOLD;
                document.getElementById('admin-conf-value').textContent = settings.AI_CONF_THRESHOLD.toFixed(2);
            }
            if (iouSlider) {
                iouSlider.value = settings.AI_IOU_THRESHOLD;
                document.getElementById('admin-iou-value').textContent = settings.AI_IOU_THRESHOLD.toFixed(2);
            }
            if (maxDetInput) maxDetInput.value = settings.AI_MAX_DET;
            if (deviceSelect) deviceSelect.value = settings.AI_DEVICE;
            if (enabledCheck) enabledCheck.checked = settings.AI_ENABLED;
        } catch (err) {
            console.error('Load AI settings error:', err);
        }
    }

    async function saveAiSettings() {
        const btn = document.getElementById('admin-save-ai');
        const status = document.getElementById('admin-ai-status');
        btn.disabled = true;
        btn.textContent = 'Đang lưu...';

        try {
            const body = {
                AI_DEVICE: document.getElementById('admin-ai-device').value,
                AI_CONF_THRESHOLD: parseFloat(document.getElementById('admin-conf-threshold').value),
                AI_IOU_THRESHOLD: parseFloat(document.getElementById('admin-iou-threshold').value),
                AI_MAX_DET: parseInt(document.getElementById('admin-max-det').value, 10),
                AI_ENABLED: document.getElementById('admin-ai-enabled').checked,
            };

            const res = await fetch('/admin/ai-settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const result = await res.json();
            if (!res.ok) throw new Error(result.error);

            status.textContent = 'Đã lưu cấu hình AI thành công.';
            status.className = 'status-msg success';
            document.dispatchEvent(
                new CustomEvent('app:ai-settings-updated', {
                    detail: { settings: result.data || body },
                })
            );
            setTimeout(() => { status.textContent = ''; }, 3000);
        } catch (err) {
            status.textContent = `Lỗi: ${err.message}`;
            status.className = 'status-msg error';
        } finally {
            btn.disabled = false;
            btn.textContent = 'Lưu thay đổi';
        }
    }

    function init() {
        syncSessionState();
        document.addEventListener('app:session-changed', syncSessionState);

        // Register stats refresh when user is deleted
        AdminUsers.setRefreshCallback(loadStats);

        const loadUsersBtn = document.getElementById('admin-load-users');
        if (loadUsersBtn) loadUsersBtn.addEventListener('click', AdminUsers.loadUsers);

        const saveAiBtn = document.getElementById('admin-save-ai');
        if (saveAiBtn) saveAiBtn.addEventListener('click', saveAiSettings);

        const confSlider = document.getElementById('admin-conf-threshold');
        const iouSlider = document.getElementById('admin-iou-threshold');

        if (confSlider) {
            confSlider.addEventListener('input', () => {
                document.getElementById('admin-conf-value').textContent = parseFloat(confSlider.value).toFixed(2);
            });
        }
        if (iouSlider) {
            iouSlider.addEventListener('input', () => {
                document.getElementById('admin-iou-value').textContent = parseFloat(iouSlider.value).toFixed(2);
            });
        }
    }

    async function loadPanel() {
        syncSessionState();
        if (currentRole !== 'admin') return;
        await Promise.all([AdminUsers.loadUsers(), loadAiSettings(), loadStats()]);
    }

    return { init, loadPanel };
})();
