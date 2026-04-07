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

        status.textContent = 'Đang tải dữ liệu ảnh...';
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

            if (!res.ok) {
                throw new Error(result.error || 'Tải dữ liệu thất bại');
            }

            const data = result.data || [];
            status.textContent = `Tìm thấy ${data.length} ảnh`;
            status.className = 'status-msg success';

            data.forEach((record) => {
                grid.appendChild(createCard(record));
            });
        } catch (err) {
            status.textContent = `Lỗi: ${err.message}`;
            status.className = 'status-msg error';
        }
    }

    function createCard(record) {
        const behaviorLabel = BEHAVIOR_MAP[record.behavior] || record.behavior;
        const captured = record.captured_at ? record.captured_at.slice(0, 16).replace('T', ' ') : '';
        const imageUrl = record.annotated_image_url || record.image_url || record.original_image_url || '';
        const confidence = formatConfidence(record.ai_confidence);
        const aiStatus = record.ai_status || (record.annotated_image_url ? 'completed' : 'legacy');
        const statusLabel = aiStatus === 'completed' ? 'Đã xử lý' : aiStatus === 'pending' ? 'Đang chờ' : 'Dữ liệu cũ';

        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `
            <img class="card-img" src="${imageUrl}" alt="Bò ${record.cow_id}" onerror="this.style.display='none'">
            <div class="card-body">
                <div class="card-top">
                    <span class="card-cow-id">Bò: ${record.cow_id}</span>
                    <span class="badge badge-${record.behavior}">${behaviorLabel}</span>
                </div>
                <p class="card-meta">Khu vực: ${record.barn_area || '-'}</p>
                <p class="card-meta">Thời gian chụp: ${captured || '-'}</p>
                <p class="card-meta">AI: ${confidence || 'chưa có'} • Trạng thái: ${statusLabel}</p>
                ${typeof record.detection_count === 'number' ? `<p class="card-meta">Số khung phát hiện: ${record.detection_count}</p>` : ''}
                ${record.notes ? `<p class="card-meta">Ghi chú: ${record.notes}</p>` : ''}
                <div class="gallery-links">
                    ${record.original_image_url ? `<a class="gallery-link" href="${record.original_image_url}" target="_blank" rel="noopener">Mở ảnh gốc</a>` : ''}
                    ${record.annotated_image_url ? `<a class="gallery-link" href="${record.annotated_image_url}" target="_blank" rel="noopener">Mở ảnh đã gắn khung</a>` : ''}
                </div>
                <div class="card-actions">
                    <button class="btn-icon" type="button" title="Xóa ảnh">Xóa ảnh</button>
                </div>
            </div>
        `;

        card.querySelector('.btn-icon').addEventListener('click', () => {
            openDeleteModal(record.id, record.cow_id);
        });

        return card;
    }

    function openDeleteModal(id, cowId) {
        deleteTargetId = id;
        document.getElementById('delete-msg').textContent = `Bạn có chắc muốn xóa ảnh của bò ${cowId}?`;
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
        confirmBtn.textContent = 'Đang xóa...';

        try {
            const res = await fetch(`${API_BASE}/api/images/${deleteTargetId}`, {
                method: 'DELETE',
            });

            const result = await res.json();
            if (!res.ok) {
                throw new Error(result.error || 'Xóa ảnh thất bại');
            }

            closeDeleteModal();
            loadGallery();
        } catch (err) {
            alert(`Lỗi xóa ảnh: ${err.message}`);
        } finally {
            confirmBtn.disabled = false;
            confirmBtn.textContent = 'Xóa';
        }
    }

    function resetFilters() {
        document.getElementById('filter-cow-id').value = '';
        document.getElementById('filter-behavior').value = '';
        document.getElementById('filter-barn').value = '';
        loadGallery();
    }

    function formatConfidence(value) {
        return typeof value === 'number' ? `${(value * 100).toFixed(1)}%` : '';
    }

    return { init, loadGallery };
})();
