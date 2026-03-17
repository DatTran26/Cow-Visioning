const Export = (() => {
    let records = [];
    const FIELDS = ['id', 'cow_id', 'behavior', 'barn_area', 'captured_at', 'notes', 'image_url', 'file_name', 'created_at'];

    function init() {
        document.getElementById('load-export-btn').addEventListener('click', loadData);
        document.getElementById('export-csv-btn').addEventListener('click', exportCSV);
        document.getElementById('export-json-btn').addEventListener('click', exportJSON);
    }

    async function loadData() {
        const status = document.getElementById('export-status');
        const countEl = document.getElementById('export-count');
        status.textContent = 'Đang tải dữ liệu...';
        status.className = 'status-msg info';

        const { data, error } = await supabase
            .from('cow_images')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            status.textContent = `Lỗi: ${error.message}`;
            status.className = 'status-msg error';
            return;
        }

        records = data || [];
        countEl.textContent = `Tổng cộng: ${records.length} bản ghi`;

        // Enable export buttons
        document.getElementById('export-csv-btn').disabled = records.length === 0;
        document.getElementById('export-json-btn').disabled = records.length === 0;

        // Render preview table
        const tbody = document.getElementById('export-tbody');
        tbody.innerHTML = '';
        const preview = records.slice(0, 50);
        preview.forEach(r => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${r.cow_id}</td>
                <td>${BEHAVIOR_MAP[r.behavior] || r.behavior}</td>
                <td>${r.barn_area || '—'}</td>
                <td>${(r.captured_at || '').slice(0, 16).replace('T', ' ')}</td>
                <td>${(r.notes || '—').slice(0, 40)}</td>
                <td><a href="${r.image_url}" target="_blank" style="color:#3b82f6;font-size:12px">Xem ảnh</a></td>
            `;
            tbody.appendChild(tr);
        });

        document.getElementById('export-table-wrap').hidden = false;
        if (records.length > 50) {
            status.textContent = `Hiển thị 50/${records.length} bản ghi (xuất sẽ bao gồm tất cả)`;
        } else {
            status.textContent = 'Dữ liệu đã sẵn sàng để xuất';
        }
        status.className = 'status-msg success';
    }

    function exportCSV() {
        if (records.length === 0) return;

        const header = FIELDS.join(',');
        const rows = records.map(r =>
            FIELDS.map(f => {
                let val = r[f] ?? '';
                val = String(val).replace(/"/g, '""');
                return `"${val}"`;
            }).join(',')
        );
        const csv = [header, ...rows].join('\n');
        downloadFile(csv, `cow_dataset_${timestamp()}.csv`, 'text/csv');
    }

    function exportJSON() {
        if (records.length === 0) return;

        const data = records.map(r => {
            const obj = {};
            FIELDS.forEach(f => obj[f] = r[f] ?? '');
            return obj;
        });
        const json = JSON.stringify(data, null, 2);
        downloadFile(json, `cow_dataset_${timestamp()}.json`, 'application/json');
    }

    function downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType + ';charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }

    function timestamp() {
        return new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '').replace(/(\d{8})(\d{6})/, '$1_$2');
    }

    return { init };
})();
