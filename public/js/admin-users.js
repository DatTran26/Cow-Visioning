// admin-users.js — User management table (load, change role, delete)
// Exposes window.AdminUsers = { loadUsers, changeRole, deleteUser }
window.AdminUsers = (() => {
    let _onRefresh = null;
    let selectedAdminUserIds = new Set();

    function setRefreshCallback(fn) {
        _onRefresh = fn;
    }

    function updateBatchBar() {
        const batchBar = document.getElementById('admin-batch-bar');
        const countSpan = document.getElementById('admin-batch-count');
        if (!batchBar || !countSpan) return;
        
        if (selectedAdminUserIds.size > 0) {
            countSpan.textContent = selectedAdminUserIds.size;
            batchBar.classList.remove('hidden');
            requestAnimationFrame(() => batchBar.classList.add('show'));
        } else {
            batchBar.classList.remove('show');
            setTimeout(() => {
                if (selectedAdminUserIds.size === 0) batchBar.classList.add('hidden');
            }, 300);
        }
    }

    function clearSelection() {
        selectedAdminUserIds.clear();
        const selectAll = document.getElementById('admin-users-select-all');
        if (selectAll) selectAll.checked = false;
        
        document.querySelectorAll('.admin-cb-row').forEach(cb => {
            cb.checked = false;
        });
        updateBatchBar();
    }

    async function loadUsers() {
        const tbody = document.getElementById('admin-users-tbody');
        const status = document.getElementById('admin-users-status');
        if (!tbody) return;

        status.textContent = 'Loading users...';
        status.className = 'status-msg info';

        try {
            const res = await fetch('/admin/users');
            const result = await res.json();
            if (!res.ok) throw new Error(result.details || result.error);

            const users = result.data || [];
            status.textContent = `Found ${users.length} user(s)`;
            status.className = 'status-msg success';
            clearSelection();

            tbody.innerHTML = users
                .map(
                    (user) => {
                        const statusBadge = user.is_active || user.is_active === undefined 
                            ? `<span style="color: #10b981; font-weight: 600;">Active</span>` 
                            : `<span style="color: #ef4444; font-weight: 600;">Deactivated</span>`;
                            
                        return `
                        <tr data-id="${user.id}">
                            <td style="text-align: center;">
                                <input type="checkbox" class="admin-cb admin-cb-row" value="${user.id}" />
                            </td>
                            <td>${user.id}</td>
                            <td><strong>${user.username}</strong></td>
                            <td>${user.email || '—'}</td>
                            <td>
                                <select class="admin-role-select" data-uid="${user.id}">
                                    <option value="user" ${user.role === 'user' ? 'selected' : ''}>User</option>
                                    <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option>
                                </select>
                            </td>
                            <td>${statusBadge}</td>
                            <td>${user.image_count}</td>
                            <td>${user.post_count}</td>
                            <td>${new Date(user.created_at).toLocaleDateString('en-US')}</td>
                            <td>
                                <button class="btn btn-sm btn-primary admin-save-role-btn" data-uid="${user.id}">Save</button>
                                <button class="btn btn-sm btn-danger admin-delete-btn" data-uid="${user.id}" data-uname="${user.username}">Delete</button>
                            </td>
                        </tr>
                    `}
                )
                .join('');

            // Individual Selection Map
            tbody.querySelectorAll('.admin-cb-row').forEach(cb => {
                cb.addEventListener('change', (e) => {
                    const id = parseInt(e.target.value, 10);
                    if (e.target.checked) {
                        selectedAdminUserIds.add(id);
                    } else {
                        selectedAdminUserIds.delete(id);
                    }
                    updateBatchBar();
                });
            });

            // Select All Toggle
            const selectAll = document.getElementById('admin-users-select-all');
            if (selectAll) {
                selectAll.addEventListener('change', (e) => {
                    const isChecked = e.target.checked;
                    tbody.querySelectorAll('.admin-cb-row').forEach(cb => {
                        cb.checked = isChecked;
                        const id = parseInt(cb.value, 10);
                        if (isChecked) selectedAdminUserIds.add(id);
                        else selectedAdminUserIds.delete(id);
                    });
                    updateBatchBar();
                });
            }

            tbody.querySelectorAll('.admin-save-role-btn').forEach((btn) => {
                btn.addEventListener('click', () => {
                    const uid = btn.dataset.uid;
                    const select = tbody.querySelector(`.admin-role-select[data-uid="${uid}"]`);
                    changeRole(uid, select.value);
                });
            });

            tbody.querySelectorAll('.admin-delete-btn').forEach((btn) => {
                btn.addEventListener('click', () => {
                    if (confirm(`Confirm delete user "${btn.dataset.uname}"? All associated data will be permanently removed.`)) {
                        deleteUser(btn.dataset.uid);
                    }
                });
            });
        } catch (err) {
            status.textContent = `Error: ${err.message}`;
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
            alert(`Error changing role: ${err.message}`);
        }
    }

    async function deleteUser(userId) {
        try {
            const res = await fetch(`/admin/users/${userId}`, { method: 'DELETE' });
            const result = await res.json();
            if (!res.ok) throw new Error(result.error);
            loadUsers();
            if (typeof _onRefresh === 'function') _onRefresh();
        } catch (err) {
            alert(`Error deleting user: ${err.message}`);
        }
    }
    
    async function batchDeactivate(deactivateToggle) {
        if (selectedAdminUserIds.size === 0) return;
        const msg = deactivateToggle ? `Deactivate ${selectedAdminUserIds.size} users?` : `Activate ${selectedAdminUserIds.size} users?`;
        if (!confirm(msg)) return;
        
        try {
            const res = await fetch('/admin/users/batch-deactivate', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: Array.from(selectedAdminUserIds), deactivate: deactivateToggle })
            });
            const result = await res.json();
            if (!res.ok) throw new Error(result.error);
            
            clearSelection();
            loadUsers();
        } catch (err) {
            alert('Batch update error: ' + err.message);
        }
    }

    async function batchDelete() {
        if (selectedAdminUserIds.size === 0) return;
        if (!confirm(`PERMANENTLY delete ${selectedAdminUserIds.size} users? This cannot be undone.`)) return;
        
        try {
            const res = await fetch('/admin/users/batch', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: Array.from(selectedAdminUserIds) })
            });
            const result = await res.json();
            if (!res.ok) throw new Error(result.error);
            
            clearSelection();
            loadUsers();
            if (typeof _onRefresh === 'function') _onRefresh();
        } catch (err) {
            alert('Batch delete error: ' + err.message);
        }
    }

    // Bind Batch Actions Once
    document.addEventListener('DOMContentLoaded', () => {
        document.getElementById('admin-batch-cancel-btn')?.addEventListener('click', clearSelection);
        document.getElementById('admin-batch-deactivate-btn')?.addEventListener('click', () => batchDeactivate(true));
        document.getElementById('admin-batch-activate-btn')?.addEventListener('click', () => batchDeactivate(false));
        document.getElementById('admin-batch-delete-btn')?.addEventListener('click', batchDelete);
    });

    return { loadUsers, changeRole, deleteUser, setRefreshCallback };
})();
