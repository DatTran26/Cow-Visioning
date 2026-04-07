const Upload = (() => {
    let selectedFiles = [];

    function init() {
        const dropzone = document.getElementById('dropzone');
        const fileInput = document.getElementById('file-input');
        const form = document.getElementById('upload-form');

        dropzone.addEventListener('click', () => fileInput.click());

        fileInput.addEventListener('change', (event) => {
            addFiles(Array.from(event.target.files));
            fileInput.value = '';
        });

        dropzone.addEventListener('dragover', (event) => {
            event.preventDefault();
            dropzone.classList.add('dragover');
        });
        dropzone.addEventListener('dragleave', () => {
            dropzone.classList.remove('dragover');
        });
        dropzone.addEventListener('drop', (event) => {
            event.preventDefault();
            dropzone.classList.remove('dragover');
            const files = Array.from(event.dataTransfer.files).filter((file) => file.type.startsWith('image/'));
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
            img.alt = `Ảnh xem trước ${index + 1}`;

            const btn = document.createElement('button');
            btn.className = 'remove-file';
            btn.type = 'button';
            btn.textContent = 'Xóa';
            btn.onclick = (event) => {
                event.stopPropagation();
                removeFile(index);
            };

            thumb.append(img, btn);
            container.appendChild(thumb);
        });
    }

    async function handleUpload(event) {
        event.preventDefault();

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
            showStatus(status, 'Vui lòng nhập mã con bò.', 'error');
            return;
        }
        if (selectedFiles.length === 0) {
            showStatus(status, 'Vui lòng chọn ít nhất một ảnh.', 'error');
            return;
        }

        uploadBtn.disabled = true;
        progress.hidden = false;
        showStatus(status, 'Đang tải ảnh lên và gửi AI phân tích...', 'info');

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
                    throw new Error(result.details || result.error || 'Tải ảnh thất bại');
                }

                uploaded += 1;
                lastSuccessfulRecord = result.data || null;
                if (lastSuccessfulRecord) {
                    renderAiResult(lastSuccessfulRecord);
                }
            } catch (err) {
                console.error('Upload error:', err);
                failures.push(err.message || 'Tải ảnh thất bại');
            } finally {
                processed += 1;
                progressFill.style.width = `${(processed / total) * 100}%`;
            }
        }

        uploadBtn.disabled = false;

        if (uploaded === total && lastSuccessfulRecord) {
            showStatus(status, `Đã tải thành công ${uploaded} ảnh. ${AiDisplay.buildAiSummary(lastSuccessfulRecord)}`, 'success');
            selectedFiles = [];
            document.getElementById('file-preview').innerHTML = '';
        } else if (uploaded > 0 && lastSuccessfulRecord) {
            showStatus(
                status,
                `Đã xử lý ${uploaded}/${total} ảnh. Lỗi đầu tiên: ${failures[0] || 'không xác định'}`,
                'error'
            );
        } else {
            showStatus(status, `AI xử lý thất bại: ${failures[0] || 'không xác định'}`, 'error');
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

        if (!card || !record) return;

        image.src = record.annotated_image_url || record.image_url || record.original_image_url || '';
        behavior.textContent = BEHAVIOR_MAP[record.behavior] || record.behavior || 'Không xác định';
        meta.textContent = AiDisplay.buildAiMeta(record);

        if (record.original_image_url) {
            originalLink.href = record.original_image_url;
            originalLink.hidden = false;
        } else {
            originalLink.hidden = true;
        }

        card.hidden = false;
    }

    function showStatus(element, message, type) {
        element.textContent = message;
        element.className = `status-msg ${type}`;
    }

    return { init };
})();
