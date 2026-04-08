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
    }

    async function loadData() {
        const status = document.getElementById('export-status');
        const countEl = document.getElementById('export-count');

        status.textContent = 'Loading data for export...';
        status.className = 'status-msg info';

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
            return;
        }

        countEl.textContent = `Total: ${records.length} record(s)`;
        document.getElementById('export-csv-btn').disabled = records.length === 0;
        document.getElementById('export-json-btn').disabled = records.length === 0;

        const tbody = document.getElementById('export-tbody');
        tbody.innerHTML = '';

        const preview = records.slice(0, 50);
        preview.forEach((record) => {
            const tr = document.createElement('tr');
            const previewImage = record.annotated_image_url || record.image_url || record.original_image_url || '#';
            tr.innerHTML = `
                <td>${record.cow_id}</td>
                <td>${BEHAVIOR_MAP[record.behavior] || record.behavior}</td>
                <td>${record.barn_area || '-'}</td>
                <td>${(record.captured_at || '').slice(0, 16).replace('T', ' ')}</td>
                <td>${formatConfidence(record.ai_confidence) || '-'}</td>
                <td><a class="gallery-link" href="${previewImage}" target="_blank" rel="noopener">View</a></td>
            `;
            tbody.appendChild(tr);
        });

        document.getElementById('export-table-wrap').hidden = false;
        if (records.length > 50) {
            status.textContent = `Showing first 50 of ${records.length} record(s)`;
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

    function formatConfidence(value) {
        return typeof value === 'number' ? `${(value * 100).toFixed(1)}%` : '';
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
