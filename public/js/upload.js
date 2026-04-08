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
            img.alt = `Preview image ${index + 1}`;

            const btn = document.createElement('button');
            btn.className = 'remove-file';
            btn.type = 'button';
            btn.textContent = 'Remove';
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
        const processingMode = getProcessingMode();

        if (!cowId) {
            showStatus(status, 'Please enter a Cow ID.', 'error');
            return;
        }
        if (selectedFiles.length === 0) {
            showStatus(status, 'Please select at least one image.', 'error');
            return;
        }

        uploadBtn.disabled = true;
        progress.hidden = false;
        showStatus(status, buildProcessingMessage(processingMode), 'info');

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
                formData.append('capture_source', 'upload');
                formData.append('processing_mode', processingMode);

                const res = await fetch(`${API_BASE}/api/images`, {
                    method: 'POST',
                    body: formData,
                });

                const result = await res.json();
                if (!res.ok) {
                    throw new Error(result.details || result.error || 'Upload failed');
                }

                uploaded += 1;
                lastSuccessfulRecord = result.data || null;
                if (AiDisplay.hasAiResult(lastSuccessfulRecord)) {
                    renderAiResult(lastSuccessfulRecord);
                } else {
                    hideAiResult();
                }
            } catch (err) {
                console.error('Upload error:', err);
                failures.push(err.message || 'Upload failed');
            } finally {
                processed += 1;
                progressFill.style.width = `${(processed / total) * 100}%`;
            }
        }

        uploadBtn.disabled = false;

        if (uploaded === total && lastSuccessfulRecord) {
            showStatus(
                status,
                `Successfully uploaded ${uploaded} image(s). ${AiDisplay.buildAiStateMessage(lastSuccessfulRecord, processingMode)}`,
                'success'
            );
            selectedFiles = [];
            document.getElementById('file-preview').innerHTML = '';
        } else if (uploaded > 0 && lastSuccessfulRecord) {
            showStatus(
                status,
                `Processed ${uploaded}/${total} image(s). First error: ${failures[0] || 'unknown'}`,
                'error'
            );
        } else {
            showStatus(status, `Upload failed: ${failures[0] || 'unknown'}`, 'error');
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
        if (!AiDisplay.hasAiResult(record)) {
            hideAiResult();
            return;
        }

        setAiPreviewImage(image, record);
        behavior.textContent = BEHAVIOR_MAP[record.behavior] || record.behavior || 'Unknown';
        meta.innerHTML = AiDisplay.buildAiMetaMarkup(record);

        if (record.original_image_url) {
            originalLink.href = record.original_image_url;
            originalLink.hidden = false;
        } else {
            originalLink.hidden = true;
        }

        card.hidden = false;
    }

    function hideAiResult() {
        const card = document.getElementById('upload-ai-result');
        const image = document.getElementById('upload-ai-image');
        const meta = document.getElementById('upload-ai-meta');
        const originalLink = document.getElementById('upload-ai-original-link');
        const media = image?.closest('.ai-result-media');

        if (!card) return;
        card.hidden = true;
        if (image) {
            image.onload = null;
            image.onerror = null;
            image.removeAttribute('src');
            delete image.dataset.previewCandidates;
            delete image.dataset.previewIndex;
        }
        if (media) media.classList.remove('is-empty');
        if (meta) meta.innerHTML = '';
        if (originalLink) {
            originalLink.hidden = true;
            originalLink.removeAttribute('href');
        }
    }

    function setAiPreviewImage(image, record) {
        const media = image?.closest('.ai-result-media');
        if (!image || !media) return;

        const candidates = [...new Set([
            record?.annotated_image_url,
            record?.original_image_url,
            record?.image_url,
        ].filter(Boolean))];

        image.onload = () => {
            media.classList.remove('is-empty');
        };

        image.onerror = () => {
            const nextIndex = Number(image.dataset.previewIndex || '0') + 1;
            const nextCandidates = safeParsePreviewCandidates(image.dataset.previewCandidates);

            if (nextIndex < nextCandidates.length) {
                image.dataset.previewIndex = String(nextIndex);
                image.src = nextCandidates[nextIndex];
                return;
            }

            image.removeAttribute('src');
            media.classList.add('is-empty');
        };

        if (!candidates.length) {
            image.removeAttribute('src');
            media.classList.add('is-empty');
            return;
        }

        media.classList.remove('is-empty');
        image.dataset.previewCandidates = JSON.stringify(candidates);
        image.dataset.previewIndex = '0';
        image.src = candidates[0];
    }

    function safeParsePreviewCandidates(rawValue) {
        try {
            const parsed = JSON.parse(rawValue || '[]');
            return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
            return [];
        }
    }

    function showStatus(element, message, type) {
        element.textContent = message;
        element.className = `status-msg ${type}`;
    }

    function getProcessingMode() {
        if (AiDisplay.isYoloActive()) {
            return 'yolo';
        }
        if (AiDisplay.isToolProActive()) {
            return 'tool_pro';
        }
        return 'manual';
    }

    function buildProcessingMessage(processingMode) {
        if (processingMode === 'yolo') {
            return AiDisplay.isYoloActive()
                ? 'Uploading images and running YOLO analysis...'
                : 'Uploading images. YOLO is currently off, so manual labels will be kept.';
        }
        if (processingMode === 'tool_pro') {
            return AiDisplay.isToolProActive()
                ? 'Uploading images and sending them to Tool Pro...'
                : 'Uploading images. Tool Pro is currently off, so manual labels will be kept.';
        }
        return 'Uploading images without AI analysis...';
    }

    return { init };
})();
