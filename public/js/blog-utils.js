// blog-utils.js — Shared utilities for blog modules
// Exposed as window.BlogUtils
window.BlogUtils = (() => {
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
            const snippet = text ? text.slice(0, 120) : 'phản hồi rỗng';
            throw new Error(`Phản hồi từ máy chủ không hợp lệ: ${snippet}`);
        }

        if (!response.ok) {
            throw new Error(payload.error || `Yêu cầu thất bại (${response.status})`);
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
        return d.toLocaleString('vi-VN');
    }

    return { buildApiUrl, fetchJson, escapeHtml, setStatus, formatTime };
})();
