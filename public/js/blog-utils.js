// blog-utils.js — Shared utilities for blog modules
// Exposed as window.BlogUtils
window.BlogUtils = (() => {
    const REACTION_CATALOG = {
        like: { emoji: '👍', label: 'Like' },
        love: { emoji: '❤️', label: 'Love' },
        care: { emoji: '🥰', label: 'Care' },
        haha: { emoji: '😄', label: 'Haha' },
        wow: { emoji: '😮', label: 'Wow' },
        sad: { emoji: '😢', label: 'Sad' },
        angry: { emoji: '😠', label: 'Angry' },
    };

    function buildApiUrl(path) {
        const base = typeof API_BASE === 'string' ? API_BASE.replace(/\/$/, '') : '';
        return `${base}${path}`;
    }

    async function fetchJson(url, options) {
        const response = await fetch(url, options);
        const text = await response.text();
        let payload = null;

        try {
            payload = text ? JSON.parse(text) : {};
        } catch (_err) {
            const snippet = text ? text.slice(0, 120) : 'empty response';
            throw new Error(`Invalid server response: ${snippet}`);
        }

        if (!response.ok) {
            throw new Error(payload.error || `Request failed (${response.status})`);
        }

        return payload;
    }

    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function setStatus(message, type) {
        const status = document.getElementById('blog-status');
        if (!status) return;
        status.textContent = message;
        status.className = `status-msg ${type}`;
    }

    function formatTime(value) {
        if (!value) return '';
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return '';
        return d.toLocaleString('en-US');
    }

    function getReactionCatalog() {
        return Object.entries(REACTION_CATALOG).map(([type, meta]) => ({ type, ...meta }));
    }

    function getReactionMeta(type) {
        return REACTION_CATALOG[type] || REACTION_CATALOG.like;
    }

    function normalizeReactionSummary(summary) {
        if (!summary || typeof summary !== 'object') return {};
        const normalized = {};
        for (const key of Object.keys(summary)) {
            if (!REACTION_CATALOG[key]) continue;
            const value = Number(summary[key] || 0);
            if (value > 0) normalized[key] = value;
        }
        return normalized;
    }

    function getReactionBadges(summary, maxItems = 3) {
        const normalized = normalizeReactionSummary(summary);
        return Object.entries(normalized)
            .sort((a, b) => b[1] - a[1])
            .slice(0, maxItems)
            .map(([type, count]) => ({ type, count, ...getReactionMeta(type) }));
    }

    return {
        buildApiUrl,
        fetchJson,
        escapeHtml,
        setStatus,
        formatTime,
        getReactionCatalog,
        getReactionMeta,
        normalizeReactionSummary,
        getReactionBadges,
    };
})();
