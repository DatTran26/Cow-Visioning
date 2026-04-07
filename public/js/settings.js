const Settings = (() => {
    function init() {
        const resetBtn = document.getElementById('totp-reset-btn');
        const codeInput = document.getElementById('totp-reset-code');
        const statusEl = document.getElementById('totp-reset-status');

        if (!resetBtn || !codeInput) return;

        codeInput.addEventListener('input', () => {
            codeInput.value = codeInput.value.replace(/\D/g, '').slice(0, 6);
        });

        resetBtn.addEventListener('click', async () => {
            const code = codeInput.value.trim();
            statusEl.textContent = '';
            statusEl.className = 'status-msg';

            if (code.length !== 6) {
                statusEl.textContent = 'Vui lòng nhập đủ 6 ký tự số';
                statusEl.className = 'status-msg error';
                return;
            }

            resetBtn.disabled = true;
            resetBtn.textContent = 'Đang xử lý...';

            try {
                const res = await fetch(`${API_BASE}/api/totp/reset`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ code }),
                });

                const data = await res.json();

                if (res.ok && data.success) {
                    statusEl.textContent = 'Đã đặt lại cấu hình thành công! Đang chuyển hướng...';
                    statusEl.className = 'status-msg success';
                    setTimeout(() => {
                        window.location.href = '/auth/setup';
                    }, 1000);
                } else {
                    statusEl.textContent = data.error || 'Mã xác thực không hợp lệ';
                    statusEl.className = 'status-msg error';
                    codeInput.value = '';
                    codeInput.focus();
                }
            } catch (err) {
                statusEl.textContent = 'Lỗi kết nối máy chủ Hệ thống';
                statusEl.className = 'status-msg error';
            } finally {
                resetBtn.disabled = false;
                resetBtn.textContent = 'Đặt lại mật khẩu bảo vệ';
            }
        });
    }

    return { init };
})();
