window.AdminUsers = (() => {
    let onRefresh = null;
    let selectedAdminUserIds = new Set();

    function setRefreshCallback(fn) {
        onRefresh = fn;
    }

    function getElements() {
        return {
            tbody: document.getElementById('admin-users-tbody'),
            table: document.getElementById('admin-users-table'),
            status: document.getElementById('admin-users-status'),
            empty: document.getElementById('admin-users-empty'),
            selectAll: document.getElementById('admin-users-select-all'),
            search: document.getElementById('admin-user-search'),
            roleFilter: document.getElementById('admin-user-role-filter'),
            toggleBtn: document.getElementById('admin-multiple-choices-btn'),
        };
    }

    function updateBatchBar() {
        const batchBar = document.getElementById('admin-batch-bar');
        const countSpan = document.getElementById('admin-batch-count');
        if (!batchBar || !countSpan) return;

        if (selectedAdminUserIds.size > 0) {
            countSpan.textContent = String(selectedAdminUserIds.size);
            batchBar.classList.remove('hidden');
            requestAnimationFrame(() => batchBar.classList.add('show'));
            return;
        }

        batchBar.classList.remove('show');
        setTimeout(() => {
            if (selectedAdminUserIds.size === 0) batchBar.classList.add('hidden');
        }, 300);
    }

    function clearSelection() {
        selectedAdminUserIds.clear();
        const { selectAll, tbody } = getElements();
        if (selectAll) selectAll.checked = false;
        if (!tbody) return;

        tbody.querySelectorAll('.admin-cb-row').forEach((checkbox) => {
            checkbox.checked = false;
        });
        tbody.querySelectorAll('tr.selected').forEach((row) => row.classList.remove('selected'));
        updateBatchBar();
    }

    async function loadUsers() {
        const { tbody, status, empty } = getElements();
        if (!tbody || !status) return;

        status.textContent = 'Loading users...';
        status.className = 'status-msg info';
        tbody.innerHTML = '';
        if (empty) empty.hidden = true;

        try {
            const res = await fetch('/admin/users');
            const result = await res.json();
            if (!res.ok) throw new Error(result.details || result.error || 'Failed to load users');

            let users = result.data || [];
            const queryRaw = document.getElementById('admin-user-search')?.value.trim().toLowerCase() || '';
            const roleFilter = document.getElementById('admin-user-role-filter')?.value || '';

            if (queryRaw || roleFilter) {
                users = users.filter((user) => {
                    if (roleFilter && user.role !== roleFilter) return false;
                    const username = user.username?.toLowerCase() || '';
                    const email = user.email?.toLowerCase() || '';
                    return !queryRaw || username.includes(queryRaw) || email.includes(queryRaw);
                });
            }

            clearSelection();
            renderUsers(users, tbody);
            if (empty) empty.hidden = users.length > 0;
            status.textContent = `Found ${users.length} user(s)`;
            status.className = 'status-msg success';
        } catch (err) {
            status.textContent = `Error: ${err.message}`;
            status.className = 'status-msg error';
        }
    }

    function renderUsers(users, tbody) {
        const fragment = document.createDocumentFragment();
        users.forEach((user) => fragment.appendChild(createUserRow(user)));
        tbody.replaceChildren(fragment);
        bindRowEvents(tbody);
    }

    function createUserRow(user) {
        const row = document.createElement('tr');
        row.dataset.id = String(user.id);

        row.appendChild(createCheckboxCell(user.id));
        row.appendChild(createTextCell('ID', String(user.id)));
        row.appendChild(createStrongCell('Username', user.username || '-'));
        row.appendChild(createTextCell('Email', user.email || '-'));
        row.appendChild(createRoleCell(user.id, user.role || 'user'));
        row.appendChild(createBadgeCell('Status', 'admin-status-badge', user.is_active || user.is_active === undefined ? 'active' : 'inactive', user.is_active || user.is_active === undefined ? 'Active' : 'Deactivated'));
        row.appendChild(createTextCell('Images', String(user.image_count || 0), 'admin-hide-mobile'));
        row.appendChild(createTextCell('Posts', String(user.post_count || 0), 'admin-hide-mobile'));
        row.appendChild(createTextCell('Created', formatDate(user.created_at), 'admin-hide-mobile'));
        row.appendChild(createActionsCell(user));

        return row;
    }

    function createCheckboxCell(userId) {
        const cell = document.createElement('td');
        cell.className = 'admin-multi-choice-col';
        cell.style.textAlign = 'center';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'admin-cb admin-cb-row';
        checkbox.value = String(userId);
        cell.appendChild(checkbox);
        return cell;
    }

    function createTextCell(label, value, className = '') {
        const cell = document.createElement('td');
        cell.dataset.label = label;
        cell.textContent = value;
        if (className) cell.className = className;
        return cell;
    }

    function createStrongCell(label, value) {
        const cell = document.createElement('td');
        cell.dataset.label = label;
        const strong = document.createElement('strong');
        strong.textContent = value;
        cell.appendChild(strong);
        return cell;
    }

    function createRoleCell(userId, role) {
        const cell = document.createElement('td');
        cell.dataset.label = 'Role';

        const wrap = document.createElement('div');
        wrap.className = 'admin-actions-cell';

        const badge = document.createElement('span');
        badge.className = `admin-role-badge ${role}`;
        badge.textContent = role;

        const select = document.createElement('select');
        select.className = 'admin-role-select';
        select.dataset.uid = String(userId);

        const currentUser = window.AppSession?.getCurrentUser?.() || null;
        const isSelf = currentUser && Number(currentUser.id) === Number(userId);
        if (isSelf) select.disabled = true;

        ['user', 'admin'].forEach((optionValue) => {
            const option = document.createElement('option');
            option.value = optionValue;
            option.textContent = optionValue === 'user' ? 'User' : 'Admin';
            option.selected = role === optionValue;
            select.appendChild(option);
        });

        wrap.appendChild(badge);
        wrap.appendChild(select);
        cell.appendChild(wrap);
        return cell;
    }

    function createBadgeCell(label, baseClass, variant, text) {
        const cell = document.createElement('td');
        cell.dataset.label = label;
        const badge = document.createElement('span');
        badge.className = `${baseClass} ${variant}`;
        badge.textContent = text;
        cell.appendChild(badge);
        return cell;
    }

    function createActionsCell(user) {
        const cell = document.createElement('td');
        cell.dataset.label = 'Actions';
        cell.className = 'admin-actions-cell';

        const currentUser = window.AppSession?.getCurrentUser?.() || null;
        const isSelf = currentUser && Number(currentUser.id) === Number(user.id);

        const isActive = user.is_active || user.is_active === undefined;
        const statusBtn = document.createElement('button');
        statusBtn.className = `btn btn-sm ${isActive ? 'btn-warning' : 'btn-success'} admin-toggle-status-btn`;
        statusBtn.dataset.uid = String(user.id);
        statusBtn.dataset.active = String(isActive);
        statusBtn.textContent = isActive ? 'Deactivate' : 'Activate';
        if (isSelf) statusBtn.disabled = true;

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn btn-sm btn-danger admin-delete-btn';
        deleteBtn.dataset.uid = String(user.id);
        deleteBtn.dataset.uname = user.username || `User ${user.id}`;
        deleteBtn.textContent = 'Delete';
        if (isSelf) deleteBtn.disabled = true;

        cell.appendChild(statusBtn);
        cell.appendChild(deleteBtn);
        return cell;
    }

    function bindRowEvents(tbody) {
        tbody.querySelectorAll('.admin-cb-row').forEach((checkbox) => {
            checkbox.addEventListener('change', (event) => {
                const id = parseInt(event.target.value, 10);
                const row = event.target.closest('tr');
                if (event.target.checked) {
                    selectedAdminUserIds.add(id);
                    row?.classList.add('selected');
                } else {
                    selectedAdminUserIds.delete(id);
                    row?.classList.remove('selected');
                }
                syncSelectAllState();
                updateBatchBar();
            });
        });

        const selectAll = document.getElementById('admin-users-select-all');
        if (selectAll) {
            selectAll.onchange = (event) => {
                const isChecked = event.target.checked;
                tbody.querySelectorAll('.admin-cb-row').forEach((checkbox) => {
                    checkbox.checked = isChecked;
                    checkbox.dispatchEvent(new Event('change'));
                });
            };
        }

        tbody.onclick = (event) => {
            const table = document.getElementById('admin-users-table');
            if (!table?.classList.contains('selection-mode')) return;
            const row = event.target.closest('tr');
            if (!row) return;
            if (event.target.closest('button') || event.target.closest('select') || event.target.closest('.admin-cb')) return;

            const checkbox = row.querySelector('.admin-cb-row');
            if (!checkbox) return;
            checkbox.checked = !checkbox.checked;
            checkbox.dispatchEvent(new Event('change'));
        };

        tbody.querySelectorAll('.admin-role-select').forEach((select) => {
            select.addEventListener('change', () => {
                const userId = select.dataset.uid;
                changeRole(userId, select.value);
            });
        });

        tbody.querySelectorAll('.admin-toggle-status-btn').forEach((button) => {
            button.addEventListener('click', () => {
                const userId = button.dataset.uid;
                const isActive = button.dataset.active === 'true';
                if (!window.confirm(`Are you sure you want to ${isActive ? 'deactivate' : 'activate'} this user?`)) {
                    return;
                }
                toggleStatus(userId, !isActive);
            });
        });

        tbody.querySelectorAll('.admin-delete-btn').forEach((button) => {
            button.addEventListener('click', () => {
                if (!window.confirm(`Confirm delete user "${button.dataset.uname}"? All associated data will be permanently removed.`)) {
                    return;
                }
                deleteUser(button.dataset.uid);
            });
        });
    }

    function syncSelectAllState() {
        const { tbody, selectAll } = getElements();
        if (!tbody || !selectAll) return;
        const checkboxes = Array.from(tbody.querySelectorAll('.admin-cb-row'));
        selectAll.checked = checkboxes.length > 0 && checkboxes.every((checkbox) => checkbox.checked);
    }

    async function changeRole(userId, newRole) {
        try {
            const res = await fetch(`/admin/users/${userId}/role`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ role: newRole }),
            });
            const result = await res.json();
            if (!res.ok) throw new Error(result.error || 'Cannot change role');
            loadUsers();
        } catch (err) {
            window.alert(`Error changing role: ${err.message}`);
        }
    }

    async function toggleStatus(userId, newActive) {
        try {
            const res = await fetch(`/admin/users/${userId}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ is_active: newActive }),
            });
            const result = await res.json();
            if (!res.ok) throw new Error(result.error || 'Cannot change status');
            loadUsers();
            if (typeof onRefresh === 'function') onRefresh();
        } catch (err) {
            window.alert(`Error changing status: ${err.message}`);
        }
    }

    async function deleteUser(userId) {
        try {
            const res = await fetch(`/admin/users/${userId}`, { method: 'DELETE' });
            const result = await res.json();
            if (!res.ok) throw new Error(result.error || 'Cannot delete user');
            loadUsers();
            if (typeof onRefresh === 'function') onRefresh();
        } catch (err) {
            window.alert(`Error deleting user: ${err.message}`);
        }
    }

    async function batchDeactivate(deactivateToggle) {
        if (selectedAdminUserIds.size === 0) return;
        const message = deactivateToggle ? `Deactivate ${selectedAdminUserIds.size} users?` : `Activate ${selectedAdminUserIds.size} users?`;
        if (!window.confirm(message)) return;

        try {
            const res = await fetch('/admin/users/batch-deactivate', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: Array.from(selectedAdminUserIds), deactivate: deactivateToggle }),
            });
            const result = await res.json();
            if (!res.ok) throw new Error(result.error || 'Cannot update users');
            clearSelection();
            loadUsers();
        } catch (err) {
            window.alert(`Batch update error: ${err.message}`);
        }
    }

    async function batchDelete() {
        if (selectedAdminUserIds.size === 0) return;
        if (!window.confirm(`PERMANENTLY delete ${selectedAdminUserIds.size} users? This cannot be undone.`)) return;

        try {
            const res = await fetch('/admin/users/batch', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: Array.from(selectedAdminUserIds) }),
            });
            const result = await res.json();
            if (!res.ok) throw new Error(result.error || 'Cannot delete users');
            clearSelection();
            loadUsers();
            if (typeof onRefresh === 'function') onRefresh();
        } catch (err) {
            window.alert(`Batch delete error: ${err.message}`);
        }
    }

    function formatDate(value) {
        if (!value) return '-';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return '-';
        return date.toLocaleDateString('en-US');
    }

    document.addEventListener('DOMContentLoaded', () => {
        document.getElementById('admin-batch-cancel-btn')?.addEventListener('click', clearSelection);
        document.getElementById('admin-batch-deactivate-btn')?.addEventListener('click', () => batchDeactivate(true));
        document.getElementById('admin-batch-activate-btn')?.addEventListener('click', () => batchDeactivate(false));
        document.getElementById('admin-batch-delete-btn')?.addEventListener('click', batchDelete);

        document.getElementById('admin-user-search-btn')?.addEventListener('click', loadUsers);
        document.getElementById('admin-user-search')?.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') loadUsers();
        });
        document.getElementById('admin-user-reset-btn')?.addEventListener('click', () => {
            const { search, roleFilter } = getElements();
            if (search) search.value = '';
            if (roleFilter) roleFilter.value = '';
            loadUsers();
        });

        document.getElementById('admin-multiple-choices-btn')?.addEventListener('click', (event) => {
            const { table, toggleBtn } = getElements();
            if (!table || !toggleBtn) return;
            const isSelectionMode = table.classList.toggle('selection-mode');
            toggleBtn.classList.toggle('active', isSelectionMode);
            event.currentTarget.setAttribute('aria-pressed', isSelectionMode ? 'true' : 'false');
            if (!isSelectionMode) clearSelection();
        });

        // Add User Modal & Form
        const createBtn = document.getElementById('admin-create-user-btn');
        const modal = document.getElementById('admin-create-user-modal');
        const cancelBtn = document.getElementById('admin-cancel-create-user');
        const form = document.getElementById('admin-create-user-form');
        const statusMsg = document.getElementById('admin-create-user-status');

        if (createBtn && modal) {
            createBtn.addEventListener('click', () => {
                if (form) form.reset();
                if (statusMsg) {
                    statusMsg.textContent = '';
                    statusMsg.className = 'status-msg';
                }
                modal.hidden = false;
            });
        }

        if (cancelBtn && modal) {
            cancelBtn.addEventListener('click', () => {
                modal.hidden = true;
            });
        }

        if (form && modal) {
            form.addEventListener('submit', async (event) => {
                event.preventDefault();
                if (!statusMsg) return;

                statusMsg.textContent = 'Creating user...';
                statusMsg.className = 'status-msg info';

                const username = document.getElementById('admin-new-username').value.trim();
                const email = document.getElementById('admin-new-email').value.trim();
                const password = document.getElementById('admin-new-password').value;
                const role = document.getElementById('admin-new-role').value;
                const is_active = document.getElementById('admin-new-active').checked;

                try {
                    const res = await fetch('/admin/users', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ username, email, password, role, is_active }),
                    });
                    const result = await res.json();
                    if (!res.ok) throw new Error(result.error || 'Cannot create user');

                    statusMsg.textContent = 'User created successfully!';
                    statusMsg.className = 'status-msg success';
                    setTimeout(() => {
                        modal.hidden = true;
                        loadUsers();
                        if (typeof onRefresh === 'function') onRefresh();
                    }, 1000);
                } catch (err) {
                    statusMsg.textContent = `Error: ${err.message}`;
                    statusMsg.className = 'status-msg error';
                }
            });
        }
    });

    return { loadUsers, changeRole, deleteUser, setRefreshCallback };
})();
