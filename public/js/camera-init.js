// camera-init.js — Camera lifecycle, settings UI, shared state
// Depends on: CameraAI, CameraCapture
// Exposes window.Camera = { init, startCamera, stopCamera }
const Camera = (() => {
    // Shared mutable state — passed to CameraCapture functions
    const state = {
        stream: null,
        isOn: false,
        isCapturing: false,
        savedCount: 0,
        savedThumbs: [],
        settingsVisible: false,
        autoSaveEnabled: true,
        burstInterval: null,
        burstActive: false,
    };

    function mapCameraError(err) {
        if (!err || !err.name) return 'Không thể mở camera. Vui lòng thử lại.';
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError')
            return 'Bạn đã từ chối quyền dùng camera. Hãy cấp quyền cho trình duyệt rồi thử lại.';
        if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError')
            return 'Không tìm thấy camera trên thiết bị này.';
        if (err.name === 'NotReadableError' || err.name === 'TrackStartError')
            return 'Camera đang được ứng dụng khác sử dụng. Hãy đóng ứng dụng đó rồi thử lại.';
        if (err.name === 'OverconstrainedError' || err.name === 'ConstraintNotSatisfiedError')
            return 'Thiết bị không hỗ trợ cấu hình camera đã chọn.';
        if (err.name === 'SecurityError')
            return 'Trình duyệt đang chặn camera vì lý do bảo mật. Hãy dùng HTTPS hoặc localhost.';
        return `Không thể mở camera: ${err.message || err.name}`;
    }

    function updateAutoSaveUI() {
        const label = document.getElementById('cam-auto-save-label');
        if (!label) return;
        const isMobile = window.matchMedia('(max-width: 768px)').matches;
        if (isMobile) {
            label.textContent = state.autoSaveEnabled ? 'Tự lưu: Bật' : 'Tự lưu: Tắt';
            return;
        }
        label.textContent = state.autoSaveEnabled
            ? 'Tự lưu không cần thiết lập: Bật'
            : 'Tự lưu không cần thiết lập: Tắt';
    }

    function updateSettingsUI() {
        const camPage = document.getElementById('cam-page');
        const toggleBtn = document.getElementById('toggle-cam-settings-btn');
        const fullText = toggleBtn?.querySelector('.cam-settings-text-full');
        const mobileText = toggleBtn?.querySelector('.cam-settings-text-mobile');

        camPage.classList.toggle('settings-hidden', !state.settingsVisible);

        if (fullText && mobileText) {
            fullText.textContent = state.settingsVisible ? 'Ẩn thiết lập' : 'Hiển thị thiết lập';
            mobileText.textContent = state.settingsVisible ? 'Ẩn' : 'Thiết lập';
        } else if (toggleBtn) {
            toggleBtn.textContent = state.settingsVisible ? 'Ẩn thiết lập' : 'Hiển thị thiết lập';
        }

        updateAutoSaveUI();
    }

    function toggleSettings() {
        state.settingsVisible = !state.settingsVisible;
        updateSettingsUI();
    }

    function hideSettings() {
        state.settingsVisible = false;
        updateSettingsUI();
    }

    async function startCamera() {
        const status = document.getElementById('camera-status');
        const toggleBtn = document.getElementById('toggle-camera-btn');

        if (state.isOn) return;

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
                state.stream = await navigator.mediaDevices.getUserMedia({
                    video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: { ideal: 'environment' } },
                    audio: false,
                });
            } catch (primaryErr) {
                state.stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
                console.warn('Fallback camera constraints applied:', primaryErr);
            }

            const videoEl = document.getElementById('camera-video');
            videoEl.srcObject = state.stream;
            try {
                await videoEl.play();
            } catch (playErr) {
                console.warn('video.play failed, keep stream attached:', playErr);
            }

            document.getElementById('camera-overlay').hidden = true;
            document.getElementById('capture-btn').disabled = false;
            toggleBtn.classList.add('active');
            document.getElementById('toggle-cam-icon').textContent = 'Tắt camera';
            state.isOn = true;
            status.textContent = '';
            status.className = 'status-msg';
        } catch (err) {
            status.textContent = mapCameraError(err);
            status.className = 'status-msg error';
        }
    }

    function stopCamera() {
        CameraCapture.stopBurst(state);
        if (state.stream) {
            state.stream.getTracks().forEach((track) => track.stop());
            state.stream = null;
        }
        const toggleBtn = document.getElementById('toggle-camera-btn');
        document.getElementById('camera-video').srcObject = null;
        document.getElementById('camera-overlay').hidden = false;
        document.getElementById('capture-btn').disabled = true;
        toggleBtn.classList.remove('active');
        document.getElementById('toggle-cam-icon').textContent = 'Mở camera';
        state.isOn = false;
    }

    async function toggleCamera() {
        if (state.isOn) stopCamera();
        else await startCamera();
    }

    function init() {
        document.getElementById('toggle-camera-btn').addEventListener('click', toggleCamera);

        const captureBtn = document.getElementById('capture-btn');
        captureBtn.addEventListener('pointerdown', (event) => {
            event.preventDefault();
            CameraCapture.startBurstOrSingle(state, startCamera);
        });
        captureBtn.addEventListener('pointerup', (event) => {
            event.preventDefault();
            CameraCapture.stopBurst(state);
        });
        captureBtn.addEventListener('pointerleave', (event) => {
            event.preventDefault();
            CameraCapture.stopBurst(state);
        });
        captureBtn.addEventListener('touchstart', (event) => {
            event.preventDefault();
            CameraCapture.startBurstOrSingle(state, startCamera);
        }, { passive: false });
        captureBtn.addEventListener('touchend', (event) => {
            event.preventDefault();
            CameraCapture.stopBurst(state);
        }, { passive: false });
        captureBtn.addEventListener('touchcancel', (event) => {
            event.preventDefault();
            CameraCapture.stopBurst(state);
        }, { passive: false });

        document.getElementById('toggle-cam-settings-btn').addEventListener('click', toggleSettings);
        document.getElementById('close-cam-settings').addEventListener('click', hideSettings);

        const savedAutoSave = localStorage.getItem('cam_auto_save_enabled');
        if (savedAutoSave !== null) state.autoSaveEnabled = savedAutoSave === 'true';

        const autoSaveToggle = document.getElementById('cam-auto-save-toggle');
        autoSaveToggle.checked = state.autoSaveEnabled;
        autoSaveToggle.addEventListener('change', (event) => {
            state.autoSaveEnabled = event.target.checked;
            localStorage.setItem('cam_auto_save_enabled', String(state.autoSaveEnabled));
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

    return { init, startCamera, stopCamera };
})();
