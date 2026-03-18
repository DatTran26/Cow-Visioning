const Gallery = (() => {
    let deleteTargetId = null;

    function init() {
        document.getElementById('search-btn').addEventListener('click', loadGallery);
        document.getElementById('reset-btn').addEventListener('click', resetFilters);
        document.getElementById('cancel-delete').addEventListener('click', closeDeleteModal);
        document.getElementById('confirm-delete').addEventListener('click', confirmDelete);
    }

    async function loadGallery() {
        const status = document.getElementById('gallery-status');
        const grid = document.getElementById('gallery-grid');

        status.textContent = 'Đang tải...';
        status.className = 'status-msg info';
        grid.innerHTML = '';

        const cowId = document.getElementById('filter-cow-id').value.trim();
        const behavior = document.getElementById('filter-behavior').value;
        const barn = document.getElementById('filter-barn').value.trim();

        const params = new URLSearchParams();
        if (cowId) params.append('cow_id', cowId);
        if (behavior) params.append('behavior', behavior);
        if (barn) params.append('barn_area', barn);

        try {
            const res = await fetch(`${API_BASE}/api/images?${params}`);
            const result = await res.json();

            if (!res.ok) throw new Error(result.error || 'Tai du lieu that bai');

            const data = result.data || [];

            status.textContent = `Tìm thấy ${data.length} ảnh`;
            status.className = 'status-msg success';

            data.forEach(record => {
                grid.appendChild(createCard(record));
            });
        } catch (err) {
            status.textContent = `Lỗi: ${err.message}`;
            status.className = 'status-msg error';
        }
    }

    function createCard(r) {
        const behaviorLabel = BEHAVIOR_MAP[r.behavior] || r.behavior;
        const captured = r.captured_at ? r.captured_at.slice(0, 16).replace('T', ' ') : '';

        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `
            <img class="card-img" src="${r.image_url}" alt="Bò ${r.cow_id}"
                 onerror="this.style.display='none'">
            <div class="card-body">
                <div class="card-top">
                    <span class="card-cow-id">Bò: ${r.cow_id}</span>
                    <span class="badge badge-${r.behavior}">${behaviorLabel}</span>
                </div>
                <p class="card-meta">Khu vực: ${r.barn_area || '—'}</p>
                <p class="card-meta">${captured}</p>
                ${r.notes ? `<p class="card-meta">📝 ${r.notes}</p>` : ''}
                <div class="card-actions">
                    <button class="btn-icon" title="Xoá ảnh">🗑️</button>
                </div>
            </div>
        `;

        card.querySelector('.btn-icon').addEventListener('click', () => {
            openDeleteModal(r.id, r.cow_id);
        });

        return card;
    }

    function openDeleteModal(id, cowId) {
        deleteTargetId = id;
        document.getElementById('delete-msg').textContent =
            `Bạn có chắc muốn xoá ảnh của bò ${cowId}?`;
        document.getElementById('delete-modal').hidden = false;
    }

    function closeDeleteModal() {
        document.getElementById('delete-modal').hidden = true;
        deleteTargetId = null;
    }

    async function confirmDelete() {
        if (!deleteTargetId) return;

        const confirmBtn = document.getElementById('confirm-delete');
        confirmBtn.disabled = true;
        confirmBtn.textContent = 'Đang xoá...';

        try {
            const res = await fetch(`${API_BASE}/api/images/${deleteTargetId}`, {
                method: 'DELETE',
            });

            const result = await res.json();
            if (!res.ok) throw new Error(result.error || 'Xoa that bai');

            closeDeleteModal();
            loadGallery();
        } catch (err) {
            alert('Lỗi xoá: ' + err.message);
        } finally {
            confirmBtn.disabled = false;
            confirmBtn.textContent = 'Xoá';
        }
    }

    function resetFilters() {
        document.getElementById('filter-cow-id').value = '';
        document.getElementById('filter-behavior').value = '';
        document.getElementById('filter-barn').value = '';
        loadGallery();
    }

    return { init, loadGallery };
})();
