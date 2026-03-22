const Admin = (() => {
    let currentRole = null;

    function init() {
        // Check if user is admin, show/hide admin tab
        fetch('/auth/me').then(r => r.json()).then(data => {
            currentRole = data.user?.role;
            const adminNav = document.getElementById('admin-nav');
            const adminTab = document.getElementById('tab-admin');
            if (currentRole === 'admin' && adminNav) {
                adminNav.style.display = '';
            } else if (adminNav) {
                adminNav.style.display = 'none';
            }
            if (adminTab && currentRole !== 'admin') {
                adminTab.remove();
            }
        }).catch(() => {});

        // Bind events
        const loadUsersBtn = document.getElementById('admin-load-users');
        if (loadUsersBtn) loadUsersBtn.addEventListener('click', loadUsers);

        const saveAiBtn = document.getElementById('admin-save-ai');
        if (saveAiBtn) saveAiBtn.addEventListener('click', saveAiSettings);

        // Sliders live update
        const confSlider = document.getElementById('admin-conf-threshold');
        const iouSlider = document.getElementById('admin-iou-threshold');
        const maxDetInput = document.getElementById('admin-max-det');

        if (confSlider) confSlider.addEventListener('input', () => {
            document.getElementById('admin-conf-value').textContent = parseFloat(confSlider.value).toFixed(2);
        });
        if (iouSlider) iouSlider.addEventListener('input', () => {
            document.getElementById('admin-iou-value').textContent = parseFloat(iouSlider.value).toFixed(2);
        });
    }

    async function loadPanel() {
        if (currentRole !== 'admin') return;
        await Promise.all([loadUsers(), loadAiSettings(), loadStats()]);
    }

    async function loadStats() {
        try {
            const res = await fetch('/admin/stats');
            const data = await res.json();
            const el = document.getElementById('admin-stats');
            if (el) {
                el.innerHTML = `
                    <div class="admin-stat-card"><div class="admin-stat-num">${data.total_users}</div><div class="admin-stat-label">Nguoi dung</div></div>
                    <div class="admin-stat-card"><div class="admin-stat-num">${data.total_images}</div><div class="admin-stat-label">Anh da upload</div></div>
                    <div class="admin-stat-card"><div class="admin-stat-num">${data.total_posts}</div><div class="admin-stat-label">Bai viet</div></div>
                `;
            }
        } catch (e) { console.error('Load stats error:', e); }
    }

    async function loadUsers() {
        const tbody = document.getElementById('admin-users-tbody');
        const status = document.getElementById('admin-users-status');
        if (!tbody) return;

        status.textContent = 'Dang tai...';
        status.className = 'status-msg info';

        try {
            const res = await fetch('/admin/users');
            const result = await res.json();
            if (!res.ok) throw new Error(result.error);

            const users = result.data || [];
            status.textContent = `Tim thay ${users.length} nguoi dung`;
            status.className = 'status-msg success';

            tbody.innerHTML = users.map(u => `
                <tr data-id="${u.id}">
                    <td>${u.id}</td>
                    <td><strong>${u.username}</strong></td>
                    <td>${u.email}</td>
                    <td>
                        <select class="admin-role-select" data-uid="${u.id}" ${u.role === 'admin' ? '' : ''}>
                            <option value="user" ${u.role === 'user' ? 'selected' : ''}>User</option>
                            <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Admin</option>
                        </select>
                    </td>
                    <td>${u.image_count}</td>
                    <td>${u.post_count}</td>
                    <td>${new Date(u.created_at).toLocaleDateString('vi-VN')}</td>
                    <td>
                        <button class="btn btn-sm btn-primary admin-save-role-btn" data-uid="${u.id}">Luu</button>
                        <button class="btn btn-sm btn-danger admin-delete-btn" data-uid="${u.id}" data-uname="${u.username}">Xoa</button>
                    </td>
                </tr>
            `).join('');

            // Bind save role buttons
            tbody.querySelectorAll('.admin-save-role-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const uid = btn.dataset.uid;
                    const select = tbody.querySelector(`.admin-role-select[data-uid="${uid}"]`);
                    changeRole(uid, select.value);
                });
            });

            // Bind delete buttons
            tbody.querySelectorAll('.admin-delete-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    if (confirm(`Xac nhan xoa user "${btn.dataset.uname}"? Toan bo du lieu cua user se bi xoa.`)) {
                        deleteUser(btn.dataset.uid);
                    }
                });
            });
        } catch (err) {
            status.textContent = `Loi: ${err.message}`;
            status.className = 'status-msg error';
        }
    }

    async function changeRole(userId, newRole) {
        try {
            const res = await fetch(`/admin/users/${userId}/role`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ role: newRole }),
            });
            const result = await res.json();
            if (!res.ok) throw new Error(result.error);
            loadUsers();
        } catch (err) {
            alert('Loi doi role: ' + err.message);
        }
    }

    async function deleteUser(userId) {
        try {
            const res = await fetch(`/admin/users/${userId}`, { method: 'DELETE' });
            const result = await res.json();
            if (!res.ok) throw new Error(result.error);
            loadUsers();
            loadStats();
        } catch (err) {
            alert('Loi xoa user: ' + err.message);
        }
    }

    async function loadAiSettings() {
        try {
            const res = await fetch('/admin/ai-settings');
            const result = await res.json();
            if (!res.ok) throw new Error(result.error);

            const s = result.data;
            const confSlider = document.getElementById('admin-conf-threshold');
            const iouSlider = document.getElementById('admin-iou-threshold');
            const maxDetInput = document.getElementById('admin-max-det');
            const deviceSelect = document.getElementById('admin-ai-device');
            const enabledCheck = document.getElementById('admin-ai-enabled');

            if (confSlider) { confSlider.value = s.AI_CONF_THRESHOLD; document.getElementById('admin-conf-value').textContent = s.AI_CONF_THRESHOLD.toFixed(2); }
            if (iouSlider) { iouSlider.value = s.AI_IOU_THRESHOLD; document.getElementById('admin-iou-value').textContent = s.AI_IOU_THRESHOLD.toFixed(2); }
            if (maxDetInput) maxDetInput.value = s.AI_MAX_DET;
            if (deviceSelect) deviceSelect.value = s.AI_DEVICE;
            if (enabledCheck) enabledCheck.checked = s.AI_ENABLED;
        } catch (err) {
            console.error('Load AI settings error:', err);
        }
    }

    async function saveAiSettings() {
        const btn = document.getElementById('admin-save-ai');
        const status = document.getElementById('admin-ai-status');
        btn.disabled = true;
        btn.textContent = 'Dang luu...';

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

            status.textContent = 'Da luu thanh cong!';
            status.className = 'status-msg success';
            setTimeout(() => { status.textContent = ''; }, 3000);
        } catch (err) {
            status.textContent = `Loi: ${err.message}`;
            status.className = 'status-msg error';
        } finally {
            btn.disabled = false;
            btn.textContent = 'Luu thay doi';
        }
    }

    return { init, loadPanel };
})();
