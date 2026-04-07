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

    function showError(message) {
        if (errorEl) {
            errorEl.textContent = message;
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
        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            clearError();

            const username = usernameInput ? usernameInput.value.trim() : '';
            const password = passwordInput ? passwordInput.value : '';
            const nextUrl = sanitizeNext(searchParams.get('next'));
            if (!username || !password) {
                showError('Vui lòng nhập đầy đủ thông tin.');
                return;
            }

            let payload = { username, password };
            let endpoint = '/auth/login';
            let successRedirect = nextUrl || '/?tab=thu-thap';
            let idleBtnText = 'Đăng nhập';

            if (mode === 'register') {
                const email = emailInput ? emailInput.value.trim() : '';
                const passwordConfirm = passwordConfirmInput ? passwordConfirmInput.value : '';

                if (!email) {
                    showError('Vui lòng nhập địa chỉ email.');
                    return;
                }
                if (password.length < 8) {
                    showError('Mật khẩu cần tối thiểu 8 ký tự.');
                    return;
                }
                if (password !== passwordConfirm) {
                    showError('Mật khẩu xác nhận chưa khớp.');
                    return;
                }

                endpoint = '/auth/register';
                payload = {
                    username,
                    email,
                    password,
                    password_confirm: passwordConfirm,
                };
                successRedirect = nextUrl ? `/auth/login?next=${encodeURIComponent(nextUrl)}` : '/auth/login';
                idleBtnText = 'Tạo tài khoản';
            }

            submitBtn.disabled = true;
            submitBtn.textContent = mode === 'register' ? 'Đang tạo tài khoản...' : 'Đang đăng nhập...';

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
                    showError(data.error || 'Không thể hoàn tất yêu cầu xác thực.');
                    if (passwordInput) passwordInput.value = '';
                    if (passwordConfirmInput) passwordConfirmInput.value = '';
                    if (passwordInput) passwordInput.focus();
                }
            } catch (_err) {
                showError('Không thể kết nối tới máy chủ.');
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = idleBtnText;
            }
        });
    }
})();
