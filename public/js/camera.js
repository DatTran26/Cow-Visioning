const Camera = (() => {
    let stream = null;
    let isOn = false;
    let isCapturing = false;
    let savedCount = 0;
    let savedThumbs = []; // { url }
    let settingsVisible = false;
    let autoSaveEnabled = true;

    // Burst mode state
    let burstInterval = null;
    let burstActive = false;
    const BURST_DELAY = 500; // ms between burst shots

    function generateAutoCowId() {
        const ts = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
        return `AUTO-${ts}`;
    }

    function init() {
        document.getElementById('toggle-camera-btn').addEventListener('click', toggleCamera);

        const captureBtn = document.getElementById('capture-btn');

        // Burst mode: hold to burst, tap for single shot
        captureBtn.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            startBurstOrSingle();
        });
        captureBtn.addEventListener('pointerup', (e) => {
            e.preventDefault();
            stopBurst();
        });
        captureBtn.addEventListener('pointerleave', (e) => {
            e.preventDefault();
            stopBurst();
        });
        // Touch events for mobile
        captureBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            startBurstOrSingle();
        }, { passive: false });
        captureBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            stopBurst();
        }, { passive: false });
        captureBtn.addEventListener('touchcancel', (e) => {
            e.preventDefault();
            stopBurst();
        }, { passive: false });

        document.getElementById('toggle-cam-settings-btn').addEventListener('click', toggleSettings);
        document.getElementById('close-cam-settings').addEventListener('click', hideSettings);

        const savedAutoSave = localStorage.getItem('cam_auto_save_enabled');
        if (savedAutoSave !== null) {
            autoSaveEnabled = savedAutoSave === 'true';
        }

        const autoSaveToggle = document.getElementById('cam-auto-save-toggle');
        autoSaveToggle.checked = autoSaveEnabled;
        autoSaveToggle.addEventListener('change', (e) => {
            autoSaveEnabled = e.target.checked;
            localStorage.setItem('cam_auto_save_enabled', String(autoSaveEnabled));
            updateAutoSaveUI();
        });

        updateAutoSaveUI();
        updateSettingsUI();

        const cameraTab = document.getElementById('tab-camera');
        if (cameraTab && cameraTab.classList.contains('active')) {
            startCamera();
        }
    }

    function startBurstOrSingle() {
        if (!isOn || burstActive) return;
        burstActive = true;

        // Fire first shot immediately
        captureAndSave();

        // Start burst after holding for BURST_DELAY
        burstInterval = setInterval(() => {
            if (isOn && !isCapturing) {
                captureAndSave();
            }
        }, BURST_DELAY);
    }

    function stopBurst() {
        if (burstInterval) {
            clearInterval(burstInterval);
            burstInterval = null;
        }
        burstActive = false;
    }

    function mapCameraError(err) {
        if (!err || !err.name) return 'Khong the mo camera. Vui long thu lai.';
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
            return 'Ban da tu choi quyen camera. Hay cap quyen camera cho trinh duyet roi thu lai.';
        }
        if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
            return 'Khong tim thay camera tren thiet bi.';
        }
        if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
            return 'Camera dang duoc ung dung khac su dung. Hay dong app khac roi thu lai.';
        }
        if (err.name === 'OverconstrainedError' || err.name === 'ConstraintNotSatisfiedError') {
            return 'Cau hinh camera khong duoc ho tro tren thiet bi nay.';
        }
        if (err.name === 'SecurityError') {
            return 'Trinh duyet chan camera vi ly do bao mat. Hay dung HTTPS.';
        }
        return `Khong the mo camera: ${err.message || err.name}`;
    }

    function updateAutoSaveUI() {
        const label = document.getElementById('cam-auto-save-label');
        if (!label) return;
        const isMobile = window.matchMedia('(max-width: 768px)').matches;
        if (isMobile) {
            label.textContent = autoSaveEnabled ? 'Tự lưu: Bật' : 'Tự lưu: Tắt';
            return;
        }

        label.textContent = autoSaveEnabled
            ? 'Tự lưu không cần thiết lập: Bật'
            : 'Tự lưu không cần thiết lập: Tắt';
    }

    function toggleSettings() {
        settingsVisible = !settingsVisible;
        updateSettingsUI();
    }

    function hideSettings() {
        settingsVisible = false;
        updateSettingsUI();
    }

    function updateSettingsUI() {
        const camPage = document.getElementById('cam-page');
        const toggleBtn = document.getElementById('toggle-cam-settings-btn');
        const fullText = toggleBtn?.querySelector('.cam-settings-text-full');
        const mobileText = toggleBtn?.querySelector('.cam-settings-text-mobile');
        const isMobile = window.matchMedia('(max-width: 768px)').matches;

        camPage.classList.toggle('settings-hidden', !settingsVisible);

        if (fullText && mobileText) {
            fullText.textContent = settingsVisible
                ? '🙈 Ẩn thiết lập trước khi chụp'
                : '⚙️ Thiết lập trước khi chụp';
            mobileText.textContent = settingsVisible ? '🙈 Ẩn' : '⚙️ Thiết lập';
        } else {
            toggleBtn.textContent = settingsVisible ? '🙈 Ẩn thiết lập trước khi chụp' : '⚙️ Thiết lập trước khi chụp';
        }

        if (isMobile) {
            updateAutoSaveUI();
        }
    }

    async function toggleCamera() {
        if (isOn) {
            stopCamera();
        } else {
            await startCamera();
        }
    }

    async function startCamera() {
        const status = document.getElementById('camera-status');
        const toggleBtn = document.getElementById('toggle-camera-btn');

        if (isOn) return;

        if (!window.isSecureContext) {
            status.textContent = 'Camera can HTTPS hoac localhost.';
            status.className = 'status-msg error';
            return;
        }

        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            status.textContent = 'Trinh duyet khong ho tro getUserMedia.';
            status.className = 'status-msg error';
            return;
        }

        try {
            try {
                stream = await navigator.mediaDevices.getUserMedia({
                    video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: { ideal: 'environment' } },
                    audio: false,
                });
            } catch (primaryErr) {
                stream = await navigator.mediaDevices.getUserMedia({
                    video: true,
                    audio: false,
                });
                console.warn('Fallback camera constraints applied:', primaryErr);
            }

            const videoEl = document.getElementById('camera-video');
            videoEl.srcObject = stream;
            try {
                await videoEl.play();
            } catch (playErr) {
                console.warn('video.play failed, keep stream attached:', playErr);
            }
            document.getElementById('camera-overlay').hidden = true;
            document.getElementById('capture-btn').disabled = false;
            toggleBtn.classList.add('active');
            document.getElementById('toggle-cam-icon').textContent = '⏹';
            isOn = true;
            status.textContent = '';
            status.className = 'status-msg';
        } catch (err) {
            status.textContent = mapCameraError(err);
            status.className = 'status-msg error';
        }
    }

    function stopCamera() {
        stopBurst();
        if (stream) {
            stream.getTracks().forEach(t => t.stop());
            stream = null;
        }
        const toggleBtn = document.getElementById('toggle-camera-btn');
        document.getElementById('camera-video').srcObject = null;
        document.getElementById('camera-overlay').hidden = false;
        document.getElementById('capture-btn').disabled = true;
        toggleBtn.classList.remove('active');
        document.getElementById('toggle-cam-icon').textContent = '📷';
        isOn = false;
    }

    async function captureAndSave(event) {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }

        if (isCapturing) return;
        isCapturing = true;

        // Read settings
        const cowId = document.getElementById('cam-cow-id').value.trim();
        const barnArea = document.getElementById('cam-barn-area').value.trim();
        const notes = document.getElementById('cam-notes').value.trim();
        const status = document.getElementById('cam-upload-status');
        const cameraStatus = document.getElementById('camera-status');
        const shutterBtn = document.getElementById('capture-btn');
        const saving = document.getElementById('cam-saving');

        try {
            if (!isOn) {
                await startCamera();
                if (!isOn) {
                    cameraStatus.textContent = 'Vui long mo camera truoc khi chup';
                    cameraStatus.className = 'status-msg error';
                    return;
                }
            }

            // Disable shutter briefly to prevent double-tap
            shutterBtn.disabled = true;

            status.textContent = '';
            cameraStatus.textContent = '';

            // Capture frame
            const video = document.getElementById('camera-video');
            const canvas = document.getElementById('camera-canvas');

            let sourceWidth = video.videoWidth || video.clientWidth;
            let sourceHeight = video.videoHeight || video.clientHeight;

            if (!sourceWidth || !sourceHeight) {
                cameraStatus.textContent = 'Camera chua san sang, vui long thu lai sau 1 giay';
                cameraStatus.className = 'status-msg error';
                return;
            }

            // Scale down extremely large frames for better mobile compatibility.
            const maxWidth = 1600;
            if (sourceWidth > maxWidth) {
                const ratio = maxWidth / sourceWidth;
                sourceWidth = Math.round(sourceWidth * ratio);
                sourceHeight = Math.round(sourceHeight * ratio);
            }

            canvas.width = sourceWidth;
            canvas.height = sourceHeight;
            canvas.getContext('2d').drawImage(video, 0, 0, sourceWidth, sourceHeight);

            // Flash
            const vf = document.getElementById('camera-viewfinder');
            vf.classList.add('flash');
            setTimeout(() => vf.classList.remove('flash'), 250);

            // Convert to blob
            let blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', 0.9));
            if (!blob) {
                const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
                blob = dataURLToBlob(dataUrl);
            }

            if (!blob) {
                cameraStatus.textContent = 'Khong the tao anh tu camera, vui long thu lai';
                cameraStatus.className = 'status-msg error';
                return;
            }

            const thumbUrl = URL.createObjectURL(blob);

            // Show last thumb immediately
            const lastThumb = document.getElementById('cam-last-thumb');
            lastThumb.innerHTML = `<img src="${thumbUrl}">`;
            lastThumb.classList.add('has-img');

            if (!autoSaveEnabled && !cowId) {
                cameraStatus.textContent = 'Che do tu luu dang tat. Vui long dien Ma bo truoc khi luu.';
                cameraStatus.className = 'status-msg error';
                return;
            }

            const cowIdToSave = cowId || generateAutoCowId();
            const barnAreaToSave = barnArea || 'Chua xac dinh';
            const notesToSave = notes || 'Auto-captured (khong thiet lap truoc)';

            savedCount++;
            savedThumbs.unshift({ url: thumbUrl });
            updateSavedUI();

            // Show saving indicator
            saving.hidden = false;

            try {
                const uniqueName = `${crypto.randomUUID()}.jpg`;

                const formData = new FormData();
                formData.append('image', blob, uniqueName);
                formData.append('cow_id', cowIdToSave);
                formData.append('barn_area', barnAreaToSave);
                formData.append('captured_at', new Date().toISOString());
                formData.append('notes', notesToSave);

                const res = await fetch(`${API_BASE}/api/images`, {
                    method: 'POST',
                    body: formData,
                });

                const result = await res.json();
                if (!res.ok) throw new Error(result.details || result.error || 'Luu anh that bai');

                const savedRecord = result.data || null;
                if (savedRecord) {
                    renderAiResult(savedRecord);
                }

                cameraStatus.textContent = savedRecord
                    ? `Da luu anh. ${buildAiSummary(savedRecord)}`
                    : 'Da chup va luu anh len he thong';
                cameraStatus.className = 'status-msg success';
            } catch (err) {
                console.error('Save error:', err);
                status.textContent = 'Loi luu anh: ' + err.message;
                status.className = 'status-msg error';
            } finally {
                saving.hidden = true;
            }
        } catch (err) {
            console.error('Capture error:', err);
            cameraStatus.textContent = 'Loi khi chup anh: ' + (err.message || 'khong xac dinh');
            cameraStatus.className = 'status-msg error';
        } finally {
            if (isOn) shutterBtn.disabled = false;
            isCapturing = false;
        }
    }

    function dataURLToBlob(dataUrl) {
        if (!dataUrl) return null;
        const parts = dataUrl.split(',');
        if (parts.length !== 2) return null;
        const mimeMatch = parts[0].match(/:(.*?);/);
        const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
        const binary = atob(parts[1]);
        const len = binary.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return new Blob([bytes], { type: mime });
    }

    function updateSavedUI() {
        // Count badge on viewfinder
        const badge = document.getElementById('cam-count-badge');
        document.getElementById('cam-count-num').textContent = savedCount;
        badge.hidden = false;

        // Saved count in sidebar
        document.getElementById('cam-saved-count').textContent = savedCount;

        // Thumbnail strip in sidebar
        const strip = document.getElementById('captured-strip');
        strip.innerHTML = '';
        savedThumbs.forEach((item, i) => {
            const thumb = document.createElement('div');
            thumb.className = 'file-thumb';
            thumb.innerHTML = `
                <img src="${item.url}" alt="Ảnh ${savedCount - i}">
                <span class="thumb-index">${savedCount - i}</span>
            `;
            strip.appendChild(thumb);
        });
    }

    function renderAiResult(record) {
        const resultCard = document.getElementById('cam-ai-result');
        const imageEl = document.getElementById('cam-ai-image');
        const behaviorEl = document.getElementById('cam-ai-behavior');
        const metaEl = document.getElementById('cam-ai-meta');
        const originalLink = document.getElementById('cam-ai-original-link');
        const lastThumb = document.getElementById('cam-last-thumb');

        if (!resultCard || !record) {
            return;
        }

        const displayUrl = record.annotated_image_url || record.image_url || record.original_image_url || '';
        imageEl.src = displayUrl;
        behaviorEl.textContent = BEHAVIOR_MAP[record.behavior] || record.behavior || 'Khong xac dinh';
        metaEl.textContent = buildAiMeta(record);

        if (record.original_image_url) {
            originalLink.href = record.original_image_url;
            originalLink.hidden = false;
        } else {
            originalLink.hidden = true;
        }

        if (displayUrl) {
            lastThumb.innerHTML = `<img src="${displayUrl}" alt="AI result">`;
            lastThumb.classList.add('has-img');
        }

        resultCard.hidden = false;
    }

    function buildAiSummary(record) {
        const label = BEHAVIOR_MAP[record.behavior] || record.behavior || 'khong xac dinh';
        const confidence = formatConfidence(record.ai_confidence);
        return confidence ? `AI nhan dien ${label} (${confidence})` : `AI nhan dien ${label}`;
    }

    function buildAiMeta(record) {
        const parts = [];
        const confidence = formatConfidence(record.ai_confidence);
        if (confidence) {
            parts.push(`Do tin cay: ${confidence}`);
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

    return { init, startCamera, stopCamera };
})();
