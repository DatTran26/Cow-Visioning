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
                statusEl.textContent = 'Vui long nhap du 6 so';
                statusEl.className = 'status-msg error';
                return;
            }

            resetBtn.disabled = true;
            resetBtn.textContent = 'Dang xu ly...';

            try {
                const res = await fetch(`${API_BASE}/api/totp/reset`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ code }),
                });

                const data = await res.json();

                if (res.ok && data.success) {
                    statusEl.textContent = 'Da dat lai thanh cong! Dang chuyen huong...';
                    statusEl.className = 'status-msg success';
                    setTimeout(() => {
                        window.location.href = '/auth/setup';
                    }, 1000);
                } else {
                    statusEl.textContent = data.error || 'Ma khong hop le';
                    statusEl.className = 'status-msg error';
                    codeInput.value = '';
                    codeInput.focus();
                }
            } catch (err) {
                statusEl.textContent = 'Loi ket noi server';
                statusEl.className = 'status-msg error';
            } finally {
                resetBtn.disabled = false;
                resetBtn.textContent = 'Dat lai TOTP';
            }
        });
    }

    return { init };
})();
