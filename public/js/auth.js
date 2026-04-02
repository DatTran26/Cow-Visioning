(function () {
    const form = document.getElementById('auth-form');
    const usernameInput = document.getElementById('auth-username');
    const emailInput = document.getElementById('auth-email');
    const passwordInput = document.getElementById('auth-password');
    const passwordConfirmInput = document.getElementById('auth-password-confirm');
    const errorEl = document.getElementById('auth-error');
    const submitBtn = document.getElementById('auth-submit');
    const mode = form ? form.dataset.mode : 'login';
    const searchParams = new URLSearchParams(window.location.search);

    function sanitizeNext(nextValue) {
        if (typeof nextValue !== 'string') {
            return null;
        }

        const trimmed = nextValue.trim();
        if (!trimmed.startsWith('/') || trimmed.startsWith('//')) {
            return null;
        }

        return trimmed;
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

    function hydrateSwitchLinks() {
        const nextUrl = sanitizeNext(searchParams.get('next'));
        if (!nextUrl) {
            return;
        }

        document.querySelectorAll('a[href="/auth/login"]').forEach((anchor) => {
            anchor.href = `/auth/login?next=${encodeURIComponent(nextUrl)}`;
        });

        document.querySelectorAll('a[href="/auth/register"]').forEach((anchor) => {
            anchor.href = `/auth/register?next=${encodeURIComponent(nextUrl)}`;
        });
    }

    hydrateSwitchLinks();

    if (form && form.id === 'auth-form') {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            clearError();

            const username = usernameInput ? usernameInput.value.trim() : '';
            const password = passwordInput ? passwordInput.value : '';
            const nextUrl = sanitizeNext(searchParams.get('next'));
            if (!username || !password) {
                showError('Vui long nhap day du thong tin');
                return;
            }

            let payload = { username, password };
            let endpoint = '/auth/login';
            let successRedirect = nextUrl || '/?tab=thu-thap';
            let idleBtnText = 'Dang nhap';

            if (mode === 'register') {
                const email = emailInput ? emailInput.value.trim() : '';
                const passwordConfirm = passwordConfirmInput ? passwordConfirmInput.value : '';
                if (!email) {
                    showError('Vui long nhap email');
                    return;
                }
                if (password.length < 8) {
                    showError('Mat khau toi thieu 8 ky tu');
                    return;
                }
                if (password !== passwordConfirm) {
                    showError('Xac nhan mat khau khong khop');
                    return;
                }
                endpoint = '/auth/register';
                payload = {
                    username,
                    email,
                    password,
                    password_confirm: passwordConfirm,
                };
                successRedirect = nextUrl
                    ? `/auth/login?next=${encodeURIComponent(nextUrl)}`
                    : '/auth/login';
                idleBtnText = 'Dang ky';
            }

            submitBtn.disabled = true;
            submitBtn.textContent = mode === 'register' ? 'Dang tao tai khoan...' : 'Dang dang nhap...';

            try {
                const res = await fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });

                const data = await res.json();

                if (res.ok && (data.success || data.user)) {
                    window.location.href = successRedirect;
                } else {
                    showError(data.error || 'Dang nhap that bai');
                    if (passwordInput) passwordInput.value = '';
                    if (passwordConfirmInput) passwordConfirmInput.value = '';
                    if (passwordInput) passwordInput.focus();
                }
            } catch (err) {
                showError('Loi ket noi server');
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = idleBtnText;
            }
        });
    }
})();
