(function () {
    const form = document.getElementById('auth-form');
    const codeInput = document.getElementById('auth-code');
    const errorEl = document.getElementById('auth-error');
    const submitBtn = document.getElementById('auth-submit');

    // Only allow digits
    if (codeInput) {
        codeInput.addEventListener('input', () => {
            codeInput.value = codeInput.value.replace(/\D/g, '').slice(0, 6);
            // Auto-submit when 6 digits entered
            if (codeInput.value.length === 6) {
                form.dispatchEvent(new Event('submit', { cancelable: true }));
            }
        });
    }

    function showError(msg) {
        if (errorEl) {
            errorEl.textContent = msg;
            errorEl.hidden = false;
        }
    }

    function clearError() {
        if (errorEl) {
            errorEl.hidden = true;
        }
    }

    // Login form
    if (form && form.id === 'auth-form') {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            clearError();

            const code = codeInput.value.trim();
            if (code.length !== 6) {
                showError('Vui long nhap du 6 so');
                return;
            }

            submitBtn.disabled = true;
            submitBtn.textContent = 'Dang xac thuc...';

            try {
                const res = await fetch('/auth/verify', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ code }),
                });

                const data = await res.json();

                if (res.ok && data.success) {
                    window.location.href = '/';
                } else {
                    showError(data.error || 'Ma khong hop le');
                    codeInput.value = '';
                    codeInput.focus();
                }
            } catch (err) {
                showError('Loi ket noi server');
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Xac nhan';
            }
        });
    }

    // Setup form (verify first code)
    const setupForm = document.getElementById('setup-form');
    if (setupForm) {
        const setupCode = document.getElementById('setup-code');
        const setupBtn = document.getElementById('setup-submit');
        const setupError = document.getElementById('setup-error');

        if (setupCode) {
            setupCode.addEventListener('input', () => {
                setupCode.value = setupCode.value.replace(/\D/g, '').slice(0, 6);
            });
        }

        setupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (setupError) setupError.hidden = true;

            const code = setupCode.value.trim();
            if (code.length !== 6) {
                if (setupError) {
                    setupError.textContent = 'Vui long nhap du 6 so';
                    setupError.hidden = false;
                }
                return;
            }

            setupBtn.disabled = true;
            setupBtn.textContent = 'Dang xac thuc...';

            try {
                const res = await fetch('/auth/setup/verify', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ code }),
                });

                const data = await res.json();

                if (res.ok && data.success) {
                    window.location.href = '/';
                } else {
                    if (setupError) {
                        setupError.textContent = data.error || 'Ma khong hop le. Thu lai.';
                        setupError.hidden = false;
                    }
                    setupCode.value = '';
                    setupCode.focus();
                }
            } catch (err) {
                if (setupError) {
                    setupError.textContent = 'Loi ket noi server';
                    setupError.hidden = false;
                }
            } finally {
                setupBtn.disabled = false;
                setupBtn.textContent = 'Xac nhan va Kich hoat';
            }
        });
    }
})();
