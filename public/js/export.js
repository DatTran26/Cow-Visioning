const Export = (() => {
    let records = [];
    const FIELDS = [
        'id',
        'cow_id',
        'behavior',
        'barn_area',
        'captured_at',
        'notes',
        'image_url',
        'original_image_url',
        'annotated_image_url',
        'file_name',
        'file_size',
        'ai_confidence',
        'detection_count',
        'ai_model_name',
        'ai_inference_ms',
        'ai_status',
        'created_at',
    ];

    function init() {
        const loadBtn = document.getElementById('load-export-btn');
        const exportCsvBtn = document.getElementById('export-csv-btn');
        const exportJsonBtn = document.getElementById('export-json-btn');

        if (!loadBtn || !exportCsvBtn || !exportJsonBtn) {
            return;
        }

        loadBtn.addEventListener('click', loadData);
        exportCsvBtn.addEventListener('click', exportCSV);
        exportJsonBtn.addEventListener('click', exportJSON);
        updateSummary([]);
    }

    async function loadData() {
        const status = document.getElementById('export-status');
        const countEl = document.getElementById('export-count');
        const emptyState = document.getElementById('export-empty');
        const tableWrap = document.getElementById('export-table-wrap');

        status.textContent = 'Loading data for export...';
        status.className = 'status-msg info';
        if (emptyState) emptyState.hidden = true;
        if (tableWrap) tableWrap.hidden = true;

        try {
            const res = await fetch(`${API_BASE}/api/images`);
            const result = await res.json();

            if (!res.ok) {
                throw new Error(result.error || 'Failed to load data');
            }

            records = result.data || [];
        } catch (err) {
            status.textContent = `Error: ${err.message}`;
            status.className = 'status-msg error';
            updateSummary([]);
            if (emptyState) emptyState.hidden = false;
            return;
        }

        countEl.textContent = `Total: ${records.length} record(s)`;
        document.getElementById('export-csv-btn').disabled = records.length === 0;
        document.getElementById('export-json-btn').disabled = records.length === 0;
        updateSummary(records);

        const tbody = document.getElementById('export-tbody');
        tbody.innerHTML = '';

        const preview = records.slice(0, 50);
        preview.forEach((record) => {
            const tr = document.createElement('tr');
            const previewImage = normalizeImageUrl(record.annotated_image_url || record.image_url || record.original_image_url);
            appendCell(tr, 'Cow ID', record.cow_id || '-');
            appendCell(tr, 'Behavior', BEHAVIOR_MAP[record.behavior] || record.behavior || '-');
            appendCell(tr, 'Zone', record.barn_area || '-');
            appendCell(tr, 'Capture Time', formatDate(record.captured_at));
            
            // Render beautiful confidence bar
            const confidenceCell = document.createElement('td');
            confidenceCell.dataset.label = 'AI Confidence';
            if (typeof record.ai_confidence === 'number' && Number.isFinite(record.ai_confidence)) {
                const confPercent = record.ai_confidence * 100;
                let barColor = '#ef4444'; // Red for low
                if (confPercent >= 80) {
                    barColor = '#10b981'; // Green for high
                } else if (confPercent >= 50) {
                    barColor = '#f59e0b'; // Amber for medium
                }
                confidenceCell.innerHTML = `
                    <div class="confidence-container">
                        <div class="confidence-bar-outer">
                            <div class="confidence-bar-inner" style="width: ${confPercent}%; background: ${barColor}"></div>
                        </div>
                        <div class="confidence-text">${confPercent.toFixed(1)}%</div>
                    </div>
                `;
            } else {
                confidenceCell.textContent = '-';
            }
            tr.appendChild(confidenceCell);

            // Action view image button inside cell
            const linkCell = document.createElement('td');
            linkCell.dataset.label = 'View Image';
            if (previewImage && previewImage !== '#') {
                const link = document.createElement('a');
                link.className = 'btn-view-image';
                link.href = previewImage;
                link.target = '_blank';
                link.rel = 'noopener';
                link.innerHTML = `
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                    Xem ảnh
                `;
                linkCell.appendChild(link);
            } else {
                linkCell.textContent = '-';
            }
            tr.appendChild(linkCell);

            tbody.appendChild(tr);
        });

        if (emptyState) emptyState.hidden = records.length > 0;
        if (tableWrap) tableWrap.hidden = records.length === 0;
        if (records.length > 50) {
            status.textContent = `Showing first 50 of ${records.length} record(s)`;
        } else if (records.length === 0) {
            status.textContent = 'No records available to export';
        } else {
            status.textContent = 'Data ready for download';
        }
        status.className = 'status-msg success';
    }

    function exportCSV() {
        if (records.length === 0) return;

        const header = FIELDS.join(',');
        const rows = records.map((record) =>
            FIELDS.map((field) => {
                let value = record[field] ?? '';
                if (typeof value === 'object' && value !== null) {
                    value = JSON.stringify(value);
                }
                value = String(value).replace(/"/g, '""');
                return `"${value}"`;
            }).join(',')
        );

        const csv = [header, ...rows].join('\n');
        downloadFile(csv, `cow_dataset_${timestamp()}.csv`, 'text/csv');
    }

    function exportJSON() {
        if (records.length === 0) return;

        const data = records.map((record) => {
            const obj = {};
            FIELDS.forEach((field) => {
                obj[field] = record[field] ?? '';
            });
            return obj;
        });

        downloadFile(JSON.stringify(data, null, 2), `cow_dataset_${timestamp()}.json`, 'application/json');
    }

    function downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = filename;
        anchor.click();
        URL.revokeObjectURL(url);
    }

    function appendCell(row, label, value) {
        const cell = document.createElement('td');
        cell.dataset.label = label;
        cell.textContent = value;
        row.appendChild(cell);
    }

    function updateSummary(data) {
        const totalEl = document.getElementById('export-total-metric');
        const behaviorEl = document.getElementById('export-behavior-metric');
        const confidenceEl = document.getElementById('export-confidence-metric');
        const latestEl = document.getElementById('export-latest-metric');
        const behaviorCount = new Set(data.map((record) => record.behavior).filter(Boolean)).size;
        const confidenceValues = data
            .map((record) => record.ai_confidence)
            .filter((value) => typeof value === 'number' && Number.isFinite(value));
        const avgConfidence = confidenceValues.length
            ? confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length
            : null;
        const latestCapture = data
            .map((record) => record.captured_at || record.created_at)
            .filter(Boolean)
            .sort()
            .pop();

        if (totalEl) totalEl.textContent = String(data.length);
        if (behaviorEl) behaviorEl.textContent = String(behaviorCount);
        if (confidenceEl) confidenceEl.textContent = avgConfidence === null ? '-' : formatConfidence(avgConfidence);
        if (latestEl) latestEl.textContent = latestCapture ? formatDate(latestCapture) : '-';
    }

    // Normalize image URLs stored with the VPS origin so they work on any host.
    // If the URL is absolute and points to a different origin, strip it to a
    // root-relative path and let buildApiUrl apply the current API_BASE.
    function normalizeImageUrl(url) {
        if (!url) return '#';
        try {
            const parsed = new URL(url);
            if (parsed.origin !== window.location.origin) {
                const path = parsed.pathname + parsed.search;
                return typeof buildApiUrl === 'function' ? buildApiUrl(path) : path;
            }
        } catch (_) {
            // relative URL — fall through
        }
        return typeof buildApiUrl === 'function' ? buildApiUrl(url) : url;
    }

    function formatConfidence(value) {
        return typeof value === 'number' ? `${(value * 100).toFixed(1)}%` : '';
    }

    function formatDate(value) {
        return value ? String(value).slice(0, 16).replace('T', ' ') : '-';
    }

    function timestamp() {
        return new Date()
            .toISOString()
            .slice(0, 19)
            .replace(/[-:T]/g, '')
            .replace(/(\d{8})(\d{6})/, '$1_$2');
    }

    return { init, loadData };
})();
