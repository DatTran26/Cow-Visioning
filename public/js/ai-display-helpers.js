// ai-display-helpers.js — Shared AI display utilities (upload + camera)
// Extracted from upload.js and camera-ai-display.js
// Exposed as window.AiDisplay = { buildAiSummary, buildAiMeta, formatConfidence }
// Note: BEHAVIOR_MAP is defined in api-config.js as window.BEHAVIOR_MAP
// Note: renderAiResult is kept module-specific (different DOM elements per module)
window.AiDisplay = (() => {
    function formatConfidence(value) {
        return typeof value === 'number' ? `${(value * 100).toFixed(1)}%` : '';
    }

    function buildAiSummary(record, prefix) {
        const label = BEHAVIOR_MAP[record.behavior] || record.behavior || 'không xác định';
        const confidence = formatConfidence(record.ai_confidence);
        const p = prefix || 'AI nhận diện';
        return confidence ? `${p} ${label} (${confidence})` : `${p} ${label}`;
    }

    function buildAiMeta(record) {
        const parts = [];
        const confidence = formatConfidence(record.ai_confidence);
        if (confidence) parts.push(`Độ tin cậy: ${confidence}`);
        if (typeof record.detection_count === 'number') parts.push(`Số khung phát hiện: ${record.detection_count}`);
        if (typeof record.ai_inference_ms === 'number') parts.push(`Thời gian xử lý: ${Math.round(record.ai_inference_ms)} ms`);
        return parts.join(' • ');
    }

    return { buildAiSummary, buildAiMeta, formatConfidence };
})();
