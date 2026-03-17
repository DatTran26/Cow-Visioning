const Camera = (() => {
    let stream = null;
    let isOn = false;
    let savedCount = 0;
    let savedThumbs = []; // { url }
    let settingsVisible = false;

    function init() {
        document.getElementById('toggle-camera-btn').addEventListener('click', toggleCamera);
        document.getElementById('capture-btn').addEventListener('click', captureAndSave);
        document.getElementById('toggle-cam-settings-btn').addEventListener('click', toggleSettings);
        document.getElementById('close-cam-settings').addEventListener('click', hideSettings);
        updateSettingsUI();
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

        camPage.classList.toggle('settings-hidden', !settingsVisible);
        toggleBtn.textContent = settingsVisible ? '🙈 Ẩn thiết lập trước khi chụp' : '⚙️ Thiết lập trước khi chụp';
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
        try {
            stream = await navigator.mediaDevices.getUserMedia({
                video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'environment' },
                audio: false,
            });
            document.getElementById('camera-video').srcObject = stream;
            document.getElementById('camera-overlay').hidden = true;
            document.getElementById('capture-btn').disabled = false;
            toggleBtn.classList.add('active');
            document.getElementById('toggle-cam-icon').textContent = '⏹';
            isOn = true;
            status.textContent = '';
        } catch (err) {
            status.textContent = 'Không thể mở camera: ' + err.message;
            status.className = 'status-msg error';
        }
    }

    function stopCamera() {
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

    async function captureAndSave() {
        // Validate settings
        const cowId = document.getElementById('cam-cow-id').value.trim();
        const behavior = document.getElementById('cam-behavior').value;
        const barnArea = document.getElementById('cam-barn-area').value.trim();
        const notes = document.getElementById('cam-notes').value.trim();
        const status = document.getElementById('cam-upload-status');

        if (!cowId || !behavior || !barnArea) {
            status.textContent = 'Vui lòng điền Mã bò, Hành vi và Khu vực trước khi chụp';
            status.className = 'status-msg error';
            return;
        }
        status.textContent = '';

        // Capture frame
        const video = document.getElementById('camera-video');
        const canvas = document.getElementById('camera-canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d').drawImage(video, 0, 0);

        // Flash
        const vf = document.getElementById('camera-viewfinder');
        vf.classList.add('flash');
        setTimeout(() => vf.classList.remove('flash'), 250);

        // Convert to blob
        const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', 0.92));
        const thumbUrl = URL.createObjectURL(blob);

        // Show last thumb immediately
        const lastThumb = document.getElementById('cam-last-thumb');
        lastThumb.innerHTML = `<img src="${thumbUrl}">`;
        lastThumb.classList.add('has-img');

        // Show saving indicator
        const saving = document.getElementById('cam-saving');
        saving.hidden = false;

        // Disable shutter briefly to prevent double-tap
        const shutterBtn = document.getElementById('capture-btn');
        shutterBtn.disabled = true;

        try {
            const uniqueName = `${crypto.randomUUID()}.jpg`;

            const { error: storageError } = await supabase.storage
                .from(BUCKET_NAME)
                .upload(uniqueName, blob, { contentType: 'image/jpeg' });
            if (storageError) throw storageError;

            const { data: urlData } = supabase.storage
                .from(BUCKET_NAME)
                .getPublicUrl(uniqueName);

            const { error: dbError } = await supabase
                .from('cow_images')
                .insert({
                    cow_id: cowId,
                    behavior: behavior,
                    barn_area: barnArea,
                    captured_at: new Date().toISOString(),
                    notes: notes || null,
                    image_url: urlData.publicUrl,
                    file_name: uniqueName,
                    file_size: blob.size,
                });
            if (dbError) throw dbError;

            savedCount++;
            savedThumbs.unshift({ url: thumbUrl });
            updateSavedUI();
        } catch (err) {
            console.error('Save error:', err);
            status.textContent = 'Lỗi lưu ảnh: ' + err.message;
            status.className = 'status-msg error';
        } finally {
            saving.hidden = true;
            if (isOn) shutterBtn.disabled = false;
        }
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

    return { init };
})();
