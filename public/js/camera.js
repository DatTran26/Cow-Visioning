const Camera = (() => {
    let stream = null;
    let isOn = false;
    let isCapturing = false;
    let savedCount = 0;
    let savedThumbs = [];
    let settingsVisible = false;
    let autoSaveEnabled = true;

    let burstInterval = null;
    let burstActive = false;
    const BURST_DELAY = 500;

    function generateAutoCowId() {
        const ts = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
        return `AUTO-${ts}`;
    }

    function init() {
        document.getElementById('toggle-camera-btn').addEventListener('click', toggleCamera);

        const captureBtn = document.getElementById('capture-btn');
        captureBtn.addEventListener('pointerdown', (event) => {
            event.preventDefault();
            startBurstOrSingle();
        });
        captureBtn.addEventListener('pointerup', (event) => {
            event.preventDefault();
            stopBurst();
        });
        captureBtn.addEventListener('pointerleave', (event) => {
            event.preventDefault();
            stopBurst();
        });
        captureBtn.addEventListener(
            'touchstart',
            (event) => {
                event.preventDefault();
                startBurstOrSingle();
            },
            { passive: false }
        );
        captureBtn.addEventListener(
            'touchend',
            (event) => {
                event.preventDefault();
                stopBurst();
            },
            { passive: false }
        );
        captureBtn.addEventListener(
            'touchcancel',
            (event) => {
                event.preventDefault();
                stopBurst();
            },
            { passive: false }
        );

        document.getElementById('toggle-cam-settings-btn').addEventListener('click', toggleSettings);
        document.getElementById('close-cam-settings').addEventListener('click', hideSettings);

        const savedAutoSave = localStorage.getItem('cam_auto_save_enabled');
        if (savedAutoSave !== null) {
            autoSaveEnabled = savedAutoSave === 'true';
        }

        const autoSaveToggle = document.getElementById('cam-auto-save-toggle');
        autoSaveToggle.checked = autoSaveEnabled;
        autoSaveToggle.addEventListener('change', (event) => {
            autoSaveEnabled = event.target.checked;
            localStorage.setItem('cam_auto_save_enabled', String(autoSaveEnabled));
            updateAutoSaveUI();
        });

        updateAutoSaveUI();
        updateSettingsUI();

        const appTab = document.getElementById('tab-thu-thap');
        const cameraPanel = document.getElementById('camera-panel');
        if (appTab && cameraPanel && appTab.classList.contains('active') && cameraPanel.classList.contains('active')) {
            startCamera();
        }
    }

    function startBurstOrSingle() {
        if (!isOn || burstActive) return;
        burstActive = true;
        captureAndSave();
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
        if (!err || !err.name) return 'Không thể mở camera. Vui lòng thử lại.';
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
            return 'Bạn đã từ chối quyền dùng camera. Hãy cấp quyền cho trình duyệt rồi thử lại.';
        }
        if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
            return 'Không tìm thấy camera trên thiết bị này.';
        }
        if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
            return 'Camera đang được ứng dụng khác sử dụng. Hãy đóng ứng dụng đó rồi thử lại.';
        }
        if (err.name === 'OverconstrainedError' || err.name === 'ConstraintNotSatisfiedError') {
            return 'Thiết bị không hỗ trợ cấu hình camera đã chọn.';
        }
        if (err.name === 'SecurityError') {
            return 'Trình duyệt đang chặn camera vì lý do bảo mật. Hãy dùng HTTPS hoặc localhost.';
        }
        return `Không thể mở camera: ${err.message || err.name}`;
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

        camPage.classList.toggle('settings-hidden', !settingsVisible);

        if (fullText && mobileText) {
            fullText.textContent = settingsVisible ? 'Ẩn thiết lập' : 'Hiển thị thiết lập';
            mobileText.textContent = settingsVisible ? 'Ẩn' : 'Thiết lập';
        } else if (toggleBtn) {
            toggleBtn.textContent = settingsVisible ? 'Ẩn thiết lập' : 'Hiển thị thiết lập';
        }

        updateAutoSaveUI();
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
            status.textContent = 'Camera cần HTTPS hoặc localhost để hoạt động.';
            status.className = 'status-msg error';
            return;
        }

        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            status.textContent = 'Trình duyệt không hỗ trợ truy cập camera.';
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
            document.getElementById('toggle-cam-icon').textContent = 'Tắt camera';
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
            stream.getTracks().forEach((track) => track.stop());
            stream = null;
        }
        const toggleBtn = document.getElementById('toggle-camera-btn');
        document.getElementById('camera-video').srcObject = null;
        document.getElementById('camera-overlay').hidden = false;
        document.getElementById('capture-btn').disabled = true;
        toggleBtn.classList.remove('active');
        document.getElementById('toggle-cam-icon').textContent = 'Mở camera';
        isOn = false;
    }

    async function captureAndSave(event) {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }

        if (isCapturing) return;
        isCapturing = true;

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
                    cameraStatus.textContent = 'Vui lòng bật camera trước khi chụp.';
                    cameraStatus.className = 'status-msg error';
                    return;
                }
            }

            shutterBtn.disabled = true;
            status.textContent = '';
            cameraStatus.textContent = '';

            const video = document.getElementById('camera-video');
            const canvas = document.getElementById('camera-canvas');

            let sourceWidth = video.videoWidth || video.clientWidth;
            let sourceHeight = video.videoHeight || video.clientHeight;

            if (!sourceWidth || !sourceHeight) {
                cameraStatus.textContent = 'Camera chưa sẵn sàng. Vui lòng thử lại sau khoảng một giây.';
                cameraStatus.className = 'status-msg error';
                return;
            }

            const maxWidth = 1600;
            if (sourceWidth > maxWidth) {
                const ratio = maxWidth / sourceWidth;
                sourceWidth = Math.round(sourceWidth * ratio);
                sourceHeight = Math.round(sourceHeight * ratio);
            }

            canvas.width = sourceWidth;
            canvas.height = sourceHeight;
            canvas.getContext('2d').drawImage(video, 0, 0, sourceWidth, sourceHeight);

            const viewfinder = document.getElementById('camera-viewfinder');
            viewfinder.classList.add('flash');
            setTimeout(() => viewfinder.classList.remove('flash'), 250);

            let blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
            if (!blob) {
                const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
                blob = dataURLToBlob(dataUrl);
            }

            if (!blob) {
                cameraStatus.textContent = 'Không thể tạo ảnh từ camera. Vui lòng thử lại.';
                cameraStatus.className = 'status-msg error';
                return;
            }

            const thumbUrl = URL.createObjectURL(blob);
            const lastThumb = document.getElementById('cam-last-thumb');
            lastThumb.innerHTML = `<img src="${thumbUrl}" alt="Ảnh vừa chụp">`;
            lastThumb.classList.add('has-img');

            if (!autoSaveEnabled && !cowId) {
                cameraStatus.textContent = 'Chế độ tự lưu đang tắt. Vui lòng nhập mã con bò trước khi lưu.';
                cameraStatus.className = 'status-msg error';
                return;
            }

            const cowIdToSave = cowId || generateAutoCowId();
            const barnAreaToSave = barnArea || 'Chưa xác định';
            const notesToSave = notes || 'Ảnh chụp tự động chưa có ghi chú';

            savedCount += 1;
            savedThumbs.unshift({ url: thumbUrl });
            updateSavedUI();

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
                if (!res.ok) throw new Error(result.details || result.error || 'Lưu ảnh thất bại');

                const savedRecord = result.data || null;
                if (savedRecord) {
                    renderAiResult(savedRecord);
                }

                cameraStatus.textContent = savedRecord
                    ? `Đã lưu ảnh. ${buildAiSummary(savedRecord)}`
                    : 'Đã chụp và lưu ảnh lên hệ thống.';
                cameraStatus.className = 'status-msg success';
            } catch (err) {
                console.error('Save error:', err);
                status.textContent = `Lỗi khi lưu ảnh: ${err.message}`;
                status.className = 'status-msg error';
            } finally {
                saving.hidden = true;
            }
        } catch (err) {
            console.error('Capture error:', err);
            cameraStatus.textContent = `Lỗi khi chụp ảnh: ${err.message || 'không xác định'}`;
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
        for (let i = 0; i < len; i += 1) {
            bytes[i] = binary.charCodeAt(i);
        }
        return new Blob([bytes], { type: mime });
    }

    function updateSavedUI() {
        const badge = document.getElementById('cam-count-badge');
        document.getElementById('cam-count-num').textContent = savedCount;
        badge.hidden = false;

        document.getElementById('cam-saved-count').textContent = savedCount;

        const strip = document.getElementById('captured-strip');
        strip.innerHTML = '';
        savedThumbs.forEach((item, index) => {
            const thumb = document.createElement('div');
            thumb.className = 'file-thumb';
            thumb.innerHTML = `
                <img src="${item.url}" alt="Ảnh ${savedCount - index}">
                <span class="thumb-index">${savedCount - index}</span>
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
        behaviorEl.textContent = BEHAVIOR_MAP[record.behavior] || record.behavior || 'Không xác định';
        metaEl.textContent = buildAiMeta(record);

        if (record.original_image_url) {
            originalLink.href = record.original_image_url;
            originalLink.hidden = false;
        } else {
            originalLink.hidden = true;
        }

        if (displayUrl) {
            lastThumb.innerHTML = `<img src="${displayUrl}" alt="Kết quả AI">`;
            lastThumb.classList.add('has-img');
        }

        resultCard.hidden = false;
    }

    function buildAiSummary(record) {
        const label = BEHAVIOR_MAP[record.behavior] || record.behavior || 'không xác định';
        const confidence = formatConfidence(record.ai_confidence);
        return confidence ? `AI nhận diện ${label} (${confidence})` : `AI nhận diện ${label}`;
    }

    function buildAiMeta(record) {
        const parts = [];
        const confidence = formatConfidence(record.ai_confidence);
        if (confidence) {
            parts.push(`Độ tin cậy: ${confidence}`);
        }
        if (typeof record.detection_count === 'number') {
            parts.push(`Số khung phát hiện: ${record.detection_count}`);
        }
        if (typeof record.ai_inference_ms === 'number') {
            parts.push(`Thời gian xử lý: ${Math.round(record.ai_inference_ms)} ms`);
        }
        return parts.join(' • ');
    }

    function formatConfidence(value) {
        return typeof value === 'number' ? `${(value * 100).toFixed(1)}%` : '';
    }

    return { init, startCamera, stopCamera };
})();
