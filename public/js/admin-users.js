// admin-users.js — User management table (load, change role, delete)
// Exposes window.AdminUsers = { loadUsers, changeRole, deleteUser }
window.AdminUsers = (() => {
    let _onRefresh = null;

    function setRefreshCallback(fn) {
        _onRefresh = fn;
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

            tbody.innerHTML = users
                .map(
                    (user) => `
                <tr data-id="${user.id}">
                    <td>${user.id}</td>
                    <td><strong>${user.username}</strong></td>
                    <td>${user.email}</td>
                    <td>
                        <select class="admin-role-select" data-uid="${user.id}">
                            <option value="user" ${user.role === 'user' ? 'selected' : ''}>User</option>
                            <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option>
                        </select>
                    </td>
                    <td>${user.image_count}</td>
                    <td>${user.post_count}</td>
                    <td>${new Date(user.created_at).toLocaleDateString('en-US')}</td>
                    <td>
                        <button class="btn btn-sm btn-primary admin-save-role-btn" data-uid="${user.id}">Save</button>
                        <button class="btn btn-sm btn-danger admin-delete-btn" data-uid="${user.id}" data-uname="${user.username}">Delete</button>
                    </td>
                </tr>
            `
                )
                .join('');

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

    return { loadUsers, changeRole, deleteUser, setRefreshCallback };
})();
