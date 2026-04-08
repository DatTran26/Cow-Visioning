const Upload = (() => {
    let selectedFiles = [];
    let resultCount = 0;

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

        // Results panel toggle
        document.getElementById('toggle-results-btn').addEventListener('click', () => {
            const panel = document.getElementById('upload-results-panel');
            panel.hidden = false;
            document.getElementById('upload-workspace').classList.add('results-open');
        });

        document.getElementById('close-results-btn').addEventListener('click', () => {
            const panel = document.getElementById('upload-results-panel');
            panel.hidden = true;
            document.getElementById('upload-workspace').classList.remove('results-open');
        });

        document.getElementById('clear-results-btn').addEventListener('click', clearResults);

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

                // Append each result individually (show all, not just last)
                if (AiDisplay.hasAiResult(lastSuccessfulRecord)) {
                    appendAiResult(lastSuccessfulRecord);
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

    /**
     * Append a single AI result card (compact design) to the results panel.
     * Shows the Results toggle button if this is the first result.
     */
    function appendAiResult(record) {
        if (!record || !AiDisplay.hasAiResult(record)) return;

        const list = document.getElementById('upload-results-list');
        const countBadge = document.getElementById('results-count');
        const panelCountEl = document.getElementById('results-panel-count');
        const toggleBtn = document.getElementById('toggle-results-btn');
        if (!list) return;

        resultCount += 1;

        // Update badge + panel count text
        if (countBadge) countBadge.textContent = String(resultCount);
        if (panelCountEl) {
            panelCountEl.textContent = `${resultCount} result${resultCount !== 1 ? 's' : ''}`;
        }

        // Reveal the Results button
        if (toggleBtn) toggleBtn.hidden = false;

        // Image: try annotated → original → stored image
        const imageSrc = record.annotated_image_url
            || record.original_image_url
            || record.image_url
            || '';

        const behaviorLabel = BEHAVIOR_MAP[record.behavior] || record.behavior || 'Unknown';
        const behaviorKey = String(record.behavior || '').toLowerCase();
        const confidence = AiDisplay.formatConfidence(record.ai_confidence);
        const originalUrl = record.original_image_url || record.image_url || '';
        const chipsHtml = buildResultChips(record);

        const item = document.createElement('div');
        item.className = 'upload-result-item';
        item.dataset.index = String(resultCount);
        item.innerHTML = `
            <div class="uri-img-col">
              <div class="uri-thumb-wrap${imageSrc ? '' : ' is-empty'}">
                ${imageSrc
                    ? `<img class="uri-thumb"
                           src="${escapeAttr(imageSrc)}"
                           alt="Result ${resultCount}"
                           loading="lazy"
                           onerror="this.parentElement.classList.add('is-empty');this.remove()">`
                    : ''}
                <svg class="uri-thumb-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M3 9a2 2 0 0 1 2-2h1l1-2h8l1 2h1a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9z"/>
                  <circle cx="12" cy="13" r="3"/>
                </svg>
              </div>
              <span class="uri-num">#${resultCount}</span>
            </div>
            <div class="uri-body">
              <div class="uri-header-row">
                <h4 class="uri-behavior badge-${escapeAttr(behaviorKey)}">${escapeHtml(behaviorLabel)}</h4>
                ${confidence ? `<span class="uri-conf">${confidence}</span>` : ''}
              </div>
              ${chipsHtml ? `<div class="uri-chips">${chipsHtml}</div>` : ''}
              ${originalUrl
                ? `<a class="uri-view-link" href="${escapeAttr(originalUrl)}" target="_blank" rel="noopener">
                    View image
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                  </a>`
                : ''}
            </div>`;

        // Newest on top
        list.prepend(item);
    }

    function buildResultChips(record) {
        const chips = [];
        const provider = AiDisplay.getAiProviderLabel(record);
        if (provider) chips.push(escapeHtml(provider));
        if (typeof record.detection_count === 'number') {
            chips.push(`${record.detection_count} detection${record.detection_count !== 1 ? 's' : ''}`);
        }
        if (typeof record.ai_inference_ms === 'number') {
            chips.push(`${Math.round(record.ai_inference_ms)} ms`);
        }
        return chips.map((c) => `<span class="uri-chip">${c}</span>`).join('');
    }

    function clearResults() {
        resultCount = 0;
        const list = document.getElementById('upload-results-list');
        const countBadge = document.getElementById('results-count');
        const panelCountEl = document.getElementById('results-panel-count');
        const toggleBtn = document.getElementById('toggle-results-btn');
        const panel = document.getElementById('upload-results-panel');

        if (list) list.innerHTML = '';
        if (countBadge) countBadge.textContent = '0';
        if (panelCountEl) panelCountEl.textContent = '0 results';
        if (toggleBtn) toggleBtn.hidden = true;
        if (panel) panel.hidden = true;
        document.getElementById('upload-workspace')?.classList.remove('results-open');
    }

    function escapeHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function escapeAttr(str) {
        return String(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
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
