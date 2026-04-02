const Upload = (() => {
    let selectedFiles = [];

    function init() {
        const dropzone = document.getElementById('dropzone');
        const fileInput = document.getElementById('file-input');
        const form = document.getElementById('upload-form');

        dropzone.addEventListener('click', () => fileInput.click());

        fileInput.addEventListener('change', (e) => {
            addFiles(Array.from(e.target.files));
            fileInput.value = '';
        });

        dropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropzone.classList.add('dragover');
        });
        dropzone.addEventListener('dragleave', () => {
            dropzone.classList.remove('dragover');
        });
        dropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropzone.classList.remove('dragover');
            const files = Array.from(e.dataTransfer.files).filter((file) => file.type.startsWith('image/'));
            addFiles(files);
        });

        form.addEventListener('submit', handleUpload);

        const now = new Date();
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
        document.getElementById('captured-at').value = now.toISOString().slice(0, 16);
    }

    function addFiles(files) {
        selectedFiles.push(...files);
        renderPreviews();
    }

    function removeFile(index) {
        selectedFiles.splice(index, 1);
        renderPreviews();
    }

    function renderPreviews() {
        const container = document.getElementById('file-preview');
        container.innerHTML = '';

        selectedFiles.forEach((file, index) => {
            const thumb = document.createElement('div');
            thumb.className = 'file-thumb';

            const img = document.createElement('img');
            img.src = URL.createObjectURL(file);

            const btn = document.createElement('button');
            btn.className = 'remove-file';
            btn.textContent = 'x';
            btn.onclick = (e) => {
                e.stopPropagation();
                removeFile(index);
            };

            thumb.append(img, btn);
            container.appendChild(thumb);
        });
    }

    async function handleUpload(e) {
        e.preventDefault();

        const status = document.getElementById('upload-status');
        const progress = document.getElementById('upload-progress');
        const progressFill = progress.querySelector('.progress-fill');
        const uploadBtn = document.getElementById('upload-btn');

        const cowId = document.getElementById('cow-id').value.trim();
        const barnArea = document.getElementById('barn-area').value.trim();
        const capturedAt = document.getElementById('captured-at').value;
        const notes = document.getElementById('notes').value.trim();
        const behavior = document.getElementById('upload-behavior').value;

        if (!cowId) {
            showStatus(status, 'Vui long nhap ma con bo', 'error');
            return;
        }
        if (selectedFiles.length === 0) {
            showStatus(status, 'Vui long chon it nhat 1 anh', 'error');
            return;
        }

        uploadBtn.disabled = true;
        progress.hidden = false;
        showStatus(status, 'Dang tai len va phan tich AI...', 'info');

        let uploaded = 0;
        let processed = 0;
        let lastSuccessfulRecord = null;
        const failures = [];
        const total = selectedFiles.length;

        for (const file of selectedFiles) {
            try {
                const formData = new FormData();
                formData.append('image', file);
                formData.append('cow_id', cowId);
                formData.append('barn_area', barnArea);
                formData.append('captured_at', capturedAt || new Date().toISOString());
                formData.append('notes', notes);
                formData.append('behavior', behavior);

                const res = await fetch(`${API_BASE}/api/images`, {
                    method: 'POST',
                    body: formData,
                });

                const result = await res.json();
                if (!res.ok) {
                    throw new Error(result.details || result.error || 'Upload that bai');
                }

                uploaded++;
                lastSuccessfulRecord = result.data || null;
                if (lastSuccessfulRecord) {
                    renderAiResult(lastSuccessfulRecord);
                }
            } catch (err) {
                console.error('Upload error:', err);
                failures.push(err.message || 'Upload that bai');
            } finally {
                processed++;
                progressFill.style.width = `${(processed / total) * 100}%`;
            }
        }

        uploadBtn.disabled = false;

        if (uploaded === total && lastSuccessfulRecord) {
            showStatus(
                status,
                `Da tai len thanh cong ${uploaded} anh. ${buildAiSummary(lastSuccessfulRecord)}`,
                'success'
            );
            selectedFiles = [];
            document.getElementById('file-preview').innerHTML = '';
        } else if (uploaded > 0 && lastSuccessfulRecord) {
            showStatus(
                status,
                `Da xu ly ${uploaded}/${total} anh. Loi: ${failures[0] || 'khong xac dinh'}`,
                'error'
            );
        } else {
            showStatus(status, `AI xu ly that bai: ${failures[0] || 'khong xac dinh'}`, 'error');
        }

        setTimeout(() => {
            progress.hidden = true;
            progressFill.style.width = '0%';
        }, 2500);
    }

    function renderAiResult(record) {
        const card = document.getElementById('upload-ai-result');
        const image = document.getElementById('upload-ai-image');
        const behavior = document.getElementById('upload-ai-behavior');
        const meta = document.getElementById('upload-ai-meta');
        const originalLink = document.getElementById('upload-ai-original-link');

        if (!card || !record) {
            return;
        }

        image.src = record.annotated_image_url || record.image_url || record.original_image_url || '';
        behavior.textContent = BEHAVIOR_MAP[record.behavior] || record.behavior || 'Khong xac dinh';
        meta.textContent = buildAiMeta(record);

        if (record.original_image_url) {
            originalLink.href = record.original_image_url;
            originalLink.hidden = false;
        } else {
            originalLink.hidden = true;
        }

        card.hidden = false;
    }

    function buildAiSummary(record) {
        const label = BEHAVIOR_MAP[record.behavior] || record.behavior || 'khong xac dinh';
        const conf = formatConfidence(record.ai_confidence);
        return conf ? `AI: ${label} (${conf})` : `AI: ${label}`;
    }

    function buildAiMeta(record) {
        const parts = [];
        const conf = formatConfidence(record.ai_confidence);
        if (conf) {
            parts.push(`Do tin cay: ${conf}`);
        }
        if (typeof record.detection_count === 'number') {
            parts.push(`So bbox: ${record.detection_count}`);
        }
        if (typeof record.ai_inference_ms === 'number') {
            parts.push(`Thoi gian: ${Math.round(record.ai_inference_ms)} ms`);
        }
        return parts.join(' | ');
    }

    function formatConfidence(value) {
        return typeof value === 'number' ? `${(value * 100).toFixed(1)}%` : '';
    }

    function showStatus(el, msg, type) {
        el.textContent = msg;
        el.className = `status-msg ${type}`;
    }

    return { init };
})();
