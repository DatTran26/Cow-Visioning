const Settings = (() => {
    const state = {
        loaded: false,
        linked: false,
        loadInFlight: null,
    };

    function getElements() {
        return {
            dot: document.getElementById('telegram-link-dot'),
            title: document.getElementById('telegram-link-title'),
            copy: document.getElementById('telegram-link-copy'),
            connectBtn: document.getElementById('telegram-connect-btn'),
            regenerateBtn: document.getElementById('telegram-regenerate-btn'),
            refreshBtn: document.getElementById('telegram-refresh-btn'),
            unlinkBtn: document.getElementById('telegram-unlink-btn'),
            linkBox: document.getElementById('telegram-link-box'),
            linkInput: document.getElementById('telegram-deep-link'),
            copyLinkBtn: document.getElementById('telegram-copy-link-btn'),
            openLink: document.getElementById('telegram-open-link'),
            expiry: document.getElementById('telegram-link-expiry'),
            status: document.getElementById('telegram-settings-status'),
        };
    }

    function setStatus(message, type = '') {
        const { status } = getElements();
        if (!status) return;
        status.textContent = message || '';
        status.className = `status-msg ${type}`.trim();
    }

    function setLinkActionsBusy(busy) {
        const { connectBtn, regenerateBtn } = getElements();
        if (connectBtn) connectBtn.disabled = busy;
        if (regenerateBtn) regenerateBtn.disabled = busy;
    }

    function renderStatus(data) {
        const els = getElements();
        if (!els.title) return;

        state.linked = Boolean(data?.linked);
        els.dot?.classList.toggle('active', state.linked);
        els.dot?.classList.toggle('muted', !state.linked);
        els.unlinkBtn.hidden = !state.linked;
        if (els.connectBtn) els.connectBtn.hidden = state.linked;
        if (els.regenerateBtn) els.regenerateBtn.hidden = !state.linked;

        if (state.linked) {
            const account = data.account || {};
            const username = account.telegram_username ? `@${account.telegram_username}` : `ID ${account.telegram_user_id}`;
            els.title.textContent = `Linked to ${username}`;
            els.copy.textContent = account.notifications_enabled
                ? 'Private Telegram alerts are enabled for your own cow images.'
                : 'Telegram is linked, but private alerts are muted in bot chat.';
            if (els.linkBox && !els.linkInput?.value) {
                els.linkBox.hidden = true;
            }
        } else {
            els.title.textContent = 'Telegram is not linked';
            els.copy.textContent = 'Create a private link, open the bot, then press Start to connect your account.';
            if (els.linkBox && !els.linkInput?.value) {
                els.linkBox.hidden = true;
            }
        }
    }

    function renderLoggedOut() {
        const els = getElements();
        state.loaded = false;
        state.linked = false;
        if (els.linkBox) els.linkBox.hidden = true;
        if (els.connectBtn) {
            els.connectBtn.hidden = false;
            els.connectBtn.disabled = false;
        }
        if (els.regenerateBtn) els.regenerateBtn.hidden = true;
        if (els.unlinkBtn) els.unlinkBtn.hidden = true;
        if (els.dot) {
            els.dot.classList.remove('active');
            els.dot.classList.add('muted');
        }
        if (els.title) els.title.textContent = 'Sign in to manage Telegram';
        if (els.copy) els.copy.textContent = 'Link your web account to a private Telegram chat after you log in.';
        setStatus('');
    }

    function renderLoadError(message) {
        renderStatus({ linked: false });
        const els = getElements();
        if (els.title) els.title.textContent = 'Cannot load Telegram status';
        if (els.copy) {
            els.copy.textContent = 'Use Refresh to try again. If this persists, check the database migration for Telegram linking.';
        }
        setStatus(message || 'Cannot load Telegram status', 'error');
    }

    async function load() {
        const els = getElements();
        if (!els.title) return;

        if (state.loadInFlight) return state.loadInFlight;

        state.loadInFlight = (async () => {
            try {
                setStatus('');
                els.title.textContent = 'Checking Telegram status...';
                els.copy.textContent = 'Loading your link state from the server.';

                const response = await fetch('/api/me/telegram-link', { headers: { Accept: 'application/json' } });
                const payload = await response.json();
                if (!response.ok || !payload.success) {
                    throw new Error(payload.error || 'Cannot load Telegram status');
                }
                renderStatus(payload.data);
                state.loaded = true;
                setStatus('');
            } catch (err) {
                renderLoadError(err.message || 'Cannot load Telegram status');
            } finally {
                state.loadInFlight = null;
            }
        })();

        return state.loadInFlight;
    }

    async function createLink() {
        const els = getElements();
        try {
            setStatus('Creating Telegram link...');
            setLinkActionsBusy(true);
            const response = await fetch('/api/me/telegram-link-token', { method: 'POST', headers: { Accept: 'application/json' } });
            const payload = await response.json();
            if (!response.ok || !payload.success) throw new Error(payload.error || 'Cannot create Telegram link');

            const link = payload.data?.deep_link || '';
            if (els.linkInput) els.linkInput.value = link;
            if (els.openLink) els.openLink.href = link || '#';
            if (els.linkBox) els.linkBox.hidden = false;
            if (els.expiry) els.expiry.textContent = `Single-use link. Expires in ${payload.data?.expires_in_minutes || 20} minutes.`;
            const hint = state.linked
                ? 'New link created. Open it only if you need to replace this Telegram connection.'
                : 'Telegram link created. Open it and press Start in the bot.';
            setStatus(hint, 'success');
        } catch (err) {
            setStatus(err.message || 'Cannot create Telegram link', 'error');
        } finally {
            setLinkActionsBusy(false);
        }
    }

    async function unlink() {
        if (!window.confirm('Disconnect Telegram from this web account?')) return;
        const els = getElements();
        try {
            setStatus('Disconnecting Telegram...');
            els.unlinkBtn.disabled = true;
            const response = await fetch('/api/me/telegram-unlink', { method: 'POST', headers: { Accept: 'application/json' } });
            const payload = await response.json();
            if (!response.ok || !payload.success) throw new Error(payload.error || 'Cannot disconnect Telegram');
            if (els.linkBox) els.linkBox.hidden = true;
            if (els.linkInput) els.linkInput.value = '';
            if (els.openLink) els.openLink.href = '#';
            setStatus('Telegram disconnected.', 'success');
            await load();
        } catch (err) {
            setStatus(err.message || 'Cannot disconnect Telegram', 'error');
        } finally {
            els.unlinkBtn.disabled = false;
        }
    }

    async function copyLink() {
        const { linkInput } = getElements();
        const value = linkInput?.value || '';
        if (!value) return;
        try {
            await navigator.clipboard.writeText(value);
            setStatus('Copied Telegram link.', 'success');
        } catch (_err) {
            linkInput.select();
            document.execCommand('copy');
            setStatus('Copied Telegram link.', 'success');
        }
    }

    function init() {
        const els = getElements();
        els.connectBtn?.addEventListener('click', createLink);
        els.regenerateBtn?.addEventListener('click', createLink);
        els.refreshBtn?.addEventListener('click', load);
        els.unlinkBtn?.addEventListener('click', unlink);
        els.copyLinkBtn?.addEventListener('click', copyLink);

        document.addEventListener('app:session-changed', (event) => {
            const user = event.detail?.user;
            if (user) {
                load();
                return;
            }
            renderLoggedOut();
        });

        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState !== 'visible') return;
            if (typeof AppSession === 'undefined' || !AppSession.isAuthenticated?.()) return;
            load();
        });
    }

    return { init, load };
})();
