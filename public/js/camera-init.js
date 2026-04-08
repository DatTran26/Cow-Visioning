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
        if (!err || !err.name) return 'Unable to open camera. Please try again.';
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError')
            return 'Camera access was denied. Please grant camera permissions in your browser settings and try again.';
        if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError')
            return 'No camera found on this device.';
        if (err.name === 'NotReadableError' || err.name === 'TrackStartError')
            return 'Camera is in use by another application. Please close it and try again.';
        if (err.name === 'OverconstrainedError' || err.name === 'ConstraintNotSatisfiedError')
            return 'This device does not support the selected camera configuration.';
        if (err.name === 'SecurityError')
            return 'Browser is blocking camera access for security reasons. Please use HTTPS or localhost.';
        return `Unable to open camera: ${err.message || err.name}`;
    }

    function updateAutoSaveUI() {
        const label = document.getElementById('cam-auto-save-label');
        if (!label) return;
        const isMobile = window.matchMedia('(max-width: 768px)').matches;
        if (isMobile) {
            label.textContent = state.autoSaveEnabled ? 'Auto-save: On' : 'Auto-save: Off';
            return;
        }
        label.textContent = state.autoSaveEnabled
            ? 'Auto-save without setup: On'
            : 'Auto-save without setup: Off';
    }

    function updateSettingsUI() {
        const camPage = document.getElementById('cam-page');
        const toggleBtn = document.getElementById('toggle-cam-settings-btn');
        const fullText = toggleBtn?.querySelector('.cam-settings-text-full');
        const mobileText = toggleBtn?.querySelector('.cam-settings-text-mobile');

        camPage.classList.toggle('settings-hidden', !state.settingsVisible);

        if (fullText && mobileText) {
            fullText.textContent = state.settingsVisible ? 'Hide settings' : 'Show settings';
            mobileText.textContent = state.settingsVisible ? 'Hide' : 'Settings';
        } else if (toggleBtn) {
            toggleBtn.textContent = state.settingsVisible ? 'Hide settings' : 'Show settings';
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
            status.textContent = 'Camera requires HTTPS or localhost to work.';
            status.className = 'status-msg error';
            return;
        }

        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            status.textContent = 'Your browser does not support camera access.';
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
            document.getElementById('toggle-cam-icon').textContent = 'Stop camera';
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
        document.getElementById('toggle-cam-icon').textContent = 'Start camera';
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
