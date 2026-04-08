const Gallery = (() => {
    let deleteTargetId = null;
    let currentData = [];
    let currentView = 'grid';  // 'grid' | 'list'

    // ── Icons (inline SVG strings) ──────────────────────────────────────────
    const ICONS = {
        zone:  `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>`,
        time:  `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
        eye:   `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`,
        trash: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>`,
        img:   `<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`,
    };

    // ── Behavior color mapping ──────────────────────────────────────────────
    const CHIP_COLORS = {
        standing: { bg: '#dbeafe', text: '#1d4ed8' },
        lying:    { bg: '#dcfce7', text: '#15803d' },
        eating:   { bg: '#ffedd5', text: '#c2410c' },
        drinking: { bg: '#cffafe', text: '#0e7490' },
        walking:  { bg: '#f3e8ff', text: '#7c3aed' },
        abnormal: { bg: '#fee2e2', text: '#dc2626' },
    };

    // ── Init ────────────────────────────────────────────────────────────────
    function init() {
        // Existing hooks
        document.getElementById('search-btn').addEventListener('click', loadGallery);
        document.getElementById('reset-btn').addEventListener('click', resetFilters);
        document.getElementById('cancel-delete').addEventListener('click', closeDeleteModal);
        document.getElementById('confirm-delete').addEventListener('click', confirmDelete);

        // Enter key on search inputs
        ['filter-cow-id', 'filter-barn'].forEach(id => {
            document.getElementById(id)?.addEventListener('keydown', e => {
                if (e.key === 'Enter') loadGallery();
            });
        });

        // Behavior chips
        document.querySelectorAll('.gal-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                document.querySelectorAll('.gal-chip').forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                document.getElementById('filter-behavior').value = chip.dataset.behavior;
                loadGallery();
            });
        });

        // Sort select — re-render existing data
        document.getElementById('gal-sort')?.addEventListener('change', () => {
            if (currentData.length > 0) renderCards(sortData(currentData));
        });

        // View toggle
        document.getElementById('view-grid')?.addEventListener('click', () => setView('grid'));
        document.getElementById('view-list')?.addEventListener('click', () => setView('list'));

        // Lightbox close
        document.getElementById('gal-lightbox-close')?.addEventListener('click', closeLightbox);
        document.getElementById('gal-lightbox')?.addEventListener('click', e => {
            if (e.target === e.currentTarget) closeLightbox();
        });

        // ESC key closes lightbox and delete modal
        document.addEventListener('keydown', e => {
            if (e.key === 'Escape') {
                closeLightbox();
                closeDeleteModal();
            }
        });
    }

    // ── Load gallery ────────────────────────────────────────────────────────
    async function loadGallery() {
        const status = document.getElementById('gallery-status');
        const grid   = document.getElementById('gallery-grid');

        setStatus('Loading…', 'info');
        showSkeletons(grid);

        const cowId    = document.getElementById('filter-cow-id').value.trim();
        const behavior = document.getElementById('filter-behavior').value;
        const barn     = document.getElementById('filter-barn').value.trim();

        const params = new URLSearchParams();
        if (cowId)    params.append('cow_id', cowId);
        if (behavior) params.append('behavior', behavior);
        if (barn)     params.append('barn_area', barn);

        try {
            const res    = await fetch(`${API_BASE}/api/images?${params}`);
            const result = await res.json();

            if (!res.ok) throw new Error(result.error || 'Failed to load data');

            currentData = result.data || [];
            const sorted = sortData(currentData);

            grid.innerHTML = '';
            if (sorted.length === 0) {
                showEmpty(grid, cowId || behavior || barn);
                setStatus('No images found', 'info');
            } else {
                renderCards(sorted);
                setStatus(`${sorted.length} image${sorted.length !== 1 ? 's' : ''} found`, 'success');
            }
        } catch (err) {
            grid.innerHTML = '';
            setStatus(`Error: ${err.message}`, 'error');
        }
    }

    // ── Sort ────────────────────────────────────────────────────────────────
    function sortData(data) {
        const mode = document.getElementById('gal-sort')?.value || 'newest';
        const copy = [...data];
        if (mode === 'newest') copy.sort((a, b) => new Date(b.captured_at || 0) - new Date(a.captured_at || 0));
        else if (mode === 'oldest') copy.sort((a, b) => new Date(a.captured_at || 0) - new Date(b.captured_at || 0));
        else if (mode === 'cow_id') copy.sort((a, b) => String(a.cow_id).localeCompare(String(b.cow_id)));
        else if (mode === 'confidence') copy.sort((a, b) => (b.ai_confidence || 0) - (a.ai_confidence || 0));
        return copy;
    }

    // ── Render cards ────────────────────────────────────────────────────────
    function renderCards(data) {
        const grid = document.getElementById('gallery-grid');
        grid.innerHTML = '';
        data.forEach(record => grid.appendChild(createCard(record)));
    }

    // ── Create card ─────────────────────────────────────────────────────────
    function createCard(record) {
        const behaviorLabel = BEHAVIOR_MAP[record.behavior] || record.behavior;
        const captured      = formatDate(record.captured_at);
        const imageUrl      = record.annotated_image_url || record.image_url || record.original_image_url || '';
        const aiStatus      = record.ai_status || (record.annotated_image_url ? 'completed' : 'legacy');
        const conf          = record.ai_confidence;
        const confLabel     = typeof conf === 'number' ? `${(conf * 100).toFixed(1)}%` : null;
        const confClass     = !confLabel ? 'gal-conf-none' : conf >= 0.8 ? 'gal-conf-high' : conf >= 0.5 ? 'gal-conf-mid' : 'gal-conf-low';
        const behavior      = record.behavior || '';
        const chipCol       = CHIP_COLORS[behavior] || { bg: '#f1f5f9', text: '#64748b' };

        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `
            <div class="gal-img-wrap">
                <img class="card-img" src="${escHtml(imageUrl)}" alt="Cow ${escHtml(record.cow_id)}" loading="lazy"
                     onerror="this.parentElement.style.background='#eef4f3';this.style.display='none'">
                <div class="gal-img-overlay">
                    <button class="gal-overlay-btn gal-view-full-btn" type="button">
                        ${ICONS.eye} Preview
                    </button>
                    ${record.original_image_url   ? `<a class="gal-overlay-btn" href="${escHtml(record.original_image_url)}" target="_blank" rel="noopener">Original</a>` : ''}
                    ${record.annotated_image_url  ? `<a class="gal-overlay-btn" href="${escHtml(record.annotated_image_url)}" target="_blank" rel="noopener">Annotated</a>` : ''}
                </div>
                <span class="gal-behavior-tag" style="background:${chipCol.bg};color:${chipCol.text}">${escHtml(behaviorLabel)}</span>
            </div>
            <div class="card-body">
                <div class="gal-card-top">
                    <span class="card-cow-id">Cow: ${escHtml(record.cow_id)}</span>
                    ${confLabel ? `<span class="gal-confidence ${confClass}">${confLabel}</span>` : '<span class="gal-confidence gal-conf-none">No AI</span>'}
                </div>
                <div class="gal-meta">
                    <span class="gal-meta-item">${ICONS.zone} ${escHtml(record.barn_area || '—')}</span>
                    <span class="gal-meta-item">${ICONS.time} ${escHtml(captured || '—')}</span>
                    ${typeof record.detection_count === 'number' ? `<span class="gal-meta-item">${ICONS.eye} ${record.detection_count} det.</span>` : ''}
                    <span class="gal-meta-item" style="text-transform:capitalize;font-style:italic">${aiStatus}</span>
                </div>
                ${record.notes ? `<p style="font-size:12px;color:var(--muted);margin-bottom:8px;line-height:1.5">${escHtml(record.notes)}</p>` : ''}
                <div class="gal-card-footer">
                    <div class="gal-links">
                        ${record.original_image_url  ? `<a class="gallery-link" href="${escHtml(record.original_image_url)}" target="_blank" rel="noopener">Original</a>` : ''}
                        ${record.annotated_image_url ? `<a class="gallery-link" href="${escHtml(record.annotated_image_url)}" target="_blank" rel="noopener">Annotated</a>` : ''}
                    </div>
                    <button class="gal-del-btn btn-icon" type="button" title="Delete image" aria-label="Delete image for cow ${escHtml(record.cow_id)}">${ICONS.trash}</button>
                </div>
            </div>`;

        // Preview button → lightbox
        card.querySelector('.gal-view-full-btn').addEventListener('click', e => {
            e.preventDefault();
            openLightbox(record);
        });

        // Delete button
        card.querySelector('.gal-del-btn').addEventListener('click', () => {
            openDeleteModal(record.id, record.cow_id);
        });

        return card;
    }

    // ── Skeleton loading ────────────────────────────────────────────────────
    function showSkeletons(grid) {
        grid.innerHTML = '';
        for (let i = 0; i < 6; i++) {
            const s = document.createElement('div');
            s.className = 'gal-skeleton';
            s.innerHTML = `<div class="gal-skel-img"></div>
                <div class="gal-skel-body">
                    <div class="gal-skel-line"></div>
                    <div class="gal-skel-line w-half"></div>
                    <div class="gal-skel-line w-third"></div>
                </div>`;
            grid.appendChild(s);
        }
    }

    // ── Empty state ─────────────────────────────────────────────────────────
    function showEmpty(grid, hasFilters) {
        grid.innerHTML = `
            <div class="gal-empty">
                <div class="gal-empty-icon">${ICONS.img}</div>
                <h3>${hasFilters ? 'No images match your filters' : 'No images yet'}</h3>
                <p>${hasFilters
                    ? 'Try adjusting or clearing the filters to see all images.'
                    : 'Start by uploading cattle images in the Collect Images tab.'
                }</p>
            </div>`;
    }

    // ── Status helper ───────────────────────────────────────────────────────
    function setStatus(text, type) {
        const el = document.getElementById('gallery-status');
        el.textContent = text;
        el.className   = `gal-status ${type || ''}`.trim();
    }

    // ── View toggle ─────────────────────────────────────────────────────────
    function setView(mode) {
        currentView = mode;
        const grid = document.getElementById('gallery-grid');
        grid.classList.toggle('list-view', mode === 'list');
        document.getElementById('view-grid').classList.toggle('active', mode === 'grid');
        document.getElementById('view-list').classList.toggle('active', mode === 'list');
    }

    // ── Lightbox ────────────────────────────────────────────────────────────
    function openLightbox(record) {
        const box   = document.getElementById('gal-lightbox');
        const img   = document.getElementById('gal-lightbox-img');
        const info  = document.getElementById('gal-lightbox-info');
        const bLabel  = BEHAVIOR_MAP[record.behavior] || record.behavior || '—';
        const conf    = typeof record.ai_confidence === 'number' ? `${(record.ai_confidence * 100).toFixed(1)}%` : 'N/A';
        const imageUrl = record.annotated_image_url || record.original_image_url || record.image_url || '';

        img.src = imageUrl;
        img.alt = `Cow ${record.cow_id} — ${bLabel}`;

        info.innerHTML = `
            <h4>Cow ${escHtml(record.cow_id)}</h4>
            <div class="gal-lb-row"><span class="gal-lb-label">Behavior</span><span class="gal-lb-value">${escHtml(bLabel)}</span></div>
            <div class="gal-lb-row"><span class="gal-lb-label">Zone</span><span class="gal-lb-value">${escHtml(record.barn_area || '—')}</span></div>
            <div class="gal-lb-row"><span class="gal-lb-label">Captured</span><span class="gal-lb-value">${escHtml(formatDate(record.captured_at) || '—')}</span></div>
            <div class="gal-lb-row"><span class="gal-lb-label">AI Confidence</span><span class="gal-lb-value">${conf}</span></div>
            ${typeof record.detection_count === 'number' ? `<div class="gal-lb-row"><span class="gal-lb-label">Detections</span><span class="gal-lb-value">${record.detection_count}</span></div>` : ''}
            ${record.notes ? `<div class="gal-lb-row"><span class="gal-lb-label">Notes</span><span class="gal-lb-value">${escHtml(record.notes)}</span></div>` : ''}
            <div class="gal-lb-row">
                <span class="gal-lb-label">Images</span>
                <div class="gal-lb-links">
                    ${record.original_image_url   ? `<a class="gal-lb-link" href="${escHtml(record.original_image_url)}" target="_blank" rel="noopener">Original</a>` : ''}
                    ${record.annotated_image_url  ? `<a class="gal-lb-link" href="${escHtml(record.annotated_image_url)}" target="_blank" rel="noopener">Annotated</a>` : ''}
                </div>
            </div>`;

        box.hidden = false;
        document.body.classList.add('modal-open');
    }

    function closeLightbox() {
        const box = document.getElementById('gal-lightbox');
        if (!box.hidden) {
            box.hidden = true;
            document.getElementById('gal-lightbox-img').src = '';
            document.body.classList.remove('modal-open');
        }
    }

    // ── Delete modal ────────────────────────────────────────────────────────
    function openDeleteModal(id, cowId) {
        deleteTargetId = id;
        document.getElementById('delete-msg').textContent = `Delete image for Cow ${cowId}? This action cannot be undone.`;
        document.getElementById('delete-modal').hidden = false;
        document.body.classList.add('modal-open');
    }

    function closeDeleteModal() {
        document.getElementById('delete-modal').hidden = true;
        deleteTargetId = null;
        document.body.classList.remove('modal-open');
    }

    async function confirmDelete() {
        if (!deleteTargetId) return;
        const confirmBtn = document.getElementById('confirm-delete');
        confirmBtn.disabled = true;
        confirmBtn.textContent = 'Deleting…';

        try {
            const res = await fetch(`${API_BASE}/api/images/${deleteTargetId}`, { method: 'DELETE' });
            const result = await res.json();
            if (!res.ok) throw new Error(result.error || 'Delete failed');
            closeDeleteModal();
            loadGallery();
        } catch (err) {
            alert(`Delete error: ${err.message}`);
        } finally {
            confirmBtn.disabled = false;
            confirmBtn.textContent = 'Delete';
        }
    }

    // ── Reset ────────────────────────────────────────────────────────────────
    function resetFilters() {
        document.getElementById('filter-cow-id').value  = '';
        document.getElementById('filter-behavior').value = '';
        document.getElementById('filter-barn').value    = '';
        // Reset chips
        document.querySelectorAll('.gal-chip').forEach((c, i) => c.classList.toggle('active', i === 0));
        loadGallery();
    }

    // ── Helpers ──────────────────────────────────────────────────────────────
    function formatDate(iso) {
        if (!iso) return '';
        try {
            const d = new Date(iso);
            return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                 + ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
        } catch { return iso.slice(0, 16).replace('T', ' '); }
    }

    function formatConfidence(value) {
        return typeof value === 'number' ? `${(value * 100).toFixed(1)}%` : '';
    }

    function escHtml(str) {
        return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }

    return { init, loadGallery };
})();
