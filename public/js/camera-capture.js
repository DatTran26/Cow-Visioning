// camera-capture.js — Capture, burst, blob conversion
// Depends on: CameraAI, window._cameraState set by camera-init.js
// Exposes window.CameraCapture = { captureAndSave, startBurstOrSingle, stopBurst, updateSavedUI }
window.CameraCapture = (() => {
    const BURST_DELAY = 500;

    function dataURLToBlob(dataUrl) {
        if (!dataUrl) return null;
        const parts = dataUrl.split(',');
        if (parts.length !== 2) return null;
        const mimeMatch = parts[0].match(/:(.*?);/);
        const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
        const binary = atob(parts[1]);
        const len = binary.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i += 1) bytes[i] = binary.charCodeAt(i);
        return new Blob([bytes], { type: mime });
    }

    function updateSavedUI(state) {
        const badge = document.getElementById('cam-count-badge');
        document.getElementById('cam-count-num').textContent = state.savedCount;
        badge.hidden = false;
        document.getElementById('cam-saved-count').textContent = state.savedCount;

        const strip = document.getElementById('captured-strip');
        strip.innerHTML = '';
        state.savedThumbs.forEach((item, index) => {
            const thumb = document.createElement('div');
            thumb.className = 'file-thumb';
            thumb.innerHTML = `
                <img src="${item.url}" alt="Image ${state.savedCount - index}">
                <span class="thumb-index">${state.savedCount - index}</span>
            `;
            strip.appendChild(thumb);
        });
    }

    async function captureAndSave(state, startCameraFn) {
        if (state.isCapturing) return;
        state.isCapturing = true;

        const cowId = document.getElementById('cam-cow-id').value.trim();
        const barnArea = document.getElementById('cam-barn-area').value.trim();
        const notes = document.getElementById('cam-notes').value.trim();
        const status = document.getElementById('cam-upload-status');
        const cameraStatus = document.getElementById('camera-status');
        const shutterBtn = document.getElementById('capture-btn');
        const saving = document.getElementById('cam-saving');

        try {
            if (!state.isOn) {
                await startCameraFn();
                if (!state.isOn) {
                    cameraStatus.textContent = 'Please enable the camera before capturing.';
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
                cameraStatus.textContent = 'Camera not ready. Please try again in a moment.';
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
                cameraStatus.textContent = 'Could not create image from camera. Please try again.';
                cameraStatus.className = 'status-msg error';
                return;
            }

            const thumbUrl = URL.createObjectURL(blob);
            const lastThumb = document.getElementById('cam-last-thumb');
            lastThumb.innerHTML = `<img src="${thumbUrl}" alt="Last captured image">`;
            lastThumb.classList.add('has-img');

            if (!state.autoSaveEnabled && !cowId) {
                cameraStatus.textContent = 'Auto-save is off. Please enter a Cow ID before saving.';
                cameraStatus.className = 'status-msg error';
                return;
            }

            const ts = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
            const cowIdToSave = cowId || `AUTO-${ts}`;
            const barnAreaToSave = barnArea || 'Unspecified';
            const notesToSave = notes || 'Auto-captured image, no notes';

            state.savedCount += 1;
            state.savedThumbs.unshift({ url: thumbUrl });
            updateSavedUI(state);

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
                if (!res.ok) throw new Error(result.details || result.error || 'Failed to save image');

                const savedRecord = result.data || null;
                if (savedRecord) CameraAI.renderAiResult(savedRecord);

                cameraStatus.textContent = savedRecord
                    ? `Image saved. ${CameraAI.buildAiSummary(savedRecord)}`
                    : 'Image captured and saved successfully.';
                cameraStatus.className = 'status-msg success';
            } catch (err) {
                console.error('Save error:', err);
                status.textContent = `Save error: ${err.message}`;
                status.className = 'status-msg error';
            } finally {
                saving.hidden = true;
            }
        } catch (err) {
            console.error('Capture error:', err);
            cameraStatus.textContent = `Capture error: ${err.message || 'unknown'}`;
            cameraStatus.className = 'status-msg error';
        } finally {
            if (state.isOn) shutterBtn.disabled = false;
            state.isCapturing = false;
        }
    }

    function startBurstOrSingle(state, startCameraFn) {
        if (!state.isOn || state.burstActive) return;
        state.burstActive = true;
        captureAndSave(state, startCameraFn);
        state.burstInterval = setInterval(() => {
            if (state.isOn && !state.isCapturing) {
                captureAndSave(state, startCameraFn);
            }
        }, BURST_DELAY);
    }

    function stopBurst(state) {
        if (state.burstInterval) {
            clearInterval(state.burstInterval);
            state.burstInterval = null;
        }
        state.burstActive = false;
    }

    return { captureAndSave, startBurstOrSingle, stopBurst, updateSavedUI };
})();
