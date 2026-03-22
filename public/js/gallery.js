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

        status.textContent = 'Dang tai...';
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
                throw new Error(result.error || 'Tai du lieu that bai');
            }

            const data = result.data || [];
            status.textContent = `Tim thay ${data.length} anh`;
            status.className = 'status-msg success';

            data.forEach((record) => {
                grid.appendChild(createCard(record));
            });
        } catch (err) {
            status.textContent = `Loi: ${err.message}`;
            status.className = 'status-msg error';
        }
    }

    function createCard(record) {
        const behaviorLabel = BEHAVIOR_MAP[record.behavior] || record.behavior;
        const captured = record.captured_at ? record.captured_at.slice(0, 16).replace('T', ' ') : '';
        const imageUrl = record.annotated_image_url || record.image_url || record.original_image_url || '';
        const confidence = formatConfidence(record.ai_confidence);
        const aiStatus = record.ai_status || (record.annotated_image_url ? 'completed' : 'legacy');

        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `
            <img class="card-img" src="${imageUrl}" alt="Bo ${record.cow_id}"
                 onerror="this.style.display='none'">
            <div class="card-body">
                <div class="card-top">
                    <span class="card-cow-id">Bo: ${record.cow_id}</span>
                    <span class="badge badge-${record.behavior}">${behaviorLabel}</span>
                </div>
                <p class="card-meta">Khu vuc: ${record.barn_area || '-'}</p>
                <p class="card-meta">${captured || '-'}</p>
                <p class="card-meta">AI: ${confidence || 'khong co'} | Trang thai: ${aiStatus}</p>
                ${typeof record.detection_count === 'number' ? `<p class="card-meta">Bounding boxes: ${record.detection_count}</p>` : ''}
                ${record.notes ? `<p class="card-meta">Ghi chu: ${record.notes}</p>` : ''}
                <div class="gallery-links">
                    ${record.original_image_url ? `<a class="gallery-link" href="${record.original_image_url}" target="_blank" rel="noopener">Anh goc</a>` : ''}
                    ${record.annotated_image_url ? `<a class="gallery-link" href="${record.annotated_image_url}" target="_blank" rel="noopener">Anh bbox</a>` : ''}
                </div>
                <div class="card-actions">
                    <button class="btn-icon" title="Xoa anh">🗑️</button>
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
        document.getElementById('delete-msg').textContent = `Ban co chac muon xoa anh cua bo ${cowId}?`;
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
        confirmBtn.textContent = 'Dang xoa...';

        try {
            const res = await fetch(`${API_BASE}/api/images/${deleteTargetId}`, {
                method: 'DELETE',
            });

            const result = await res.json();
            if (!res.ok) {
                throw new Error(result.error || 'Xoa that bai');
            }

            closeDeleteModal();
            loadGallery();
        } catch (err) {
            alert('Loi xoa: ' + err.message);
        } finally {
            confirmBtn.disabled = false;
            confirmBtn.textContent = 'Xoa';
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
