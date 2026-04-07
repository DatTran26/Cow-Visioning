// camera-ai-display.js — AI result rendering for camera tab
// Exposes window.CameraAI = { renderAiResult, buildAiSummary, buildAiMeta, formatConfidence }
// Note: BEHAVIOR_MAP is defined in api-config.js as window.BEHAVIOR_MAP
window.CameraAI = (() => {
    function formatConfidence(value) {
        return typeof value === 'number' ? `${(value * 100).toFixed(1)}%` : '';
    }

    function buildAiSummary(record) {
        const label = BEHAVIOR_MAP[record.behavior] || record.behavior || 'không xác định';
        const confidence = formatConfidence(record.ai_confidence);
        return confidence ? `AI nhận diện ${label} (${confidence})` : `AI nhận diện ${label}`;
    }

    function buildAiMeta(record) {
        const parts = [];
        const confidence = formatConfidence(record.ai_confidence);
        if (confidence) parts.push(`Độ tin cậy: ${confidence}`);
        if (typeof record.detection_count === 'number') parts.push(`Số khung phát hiện: ${record.detection_count}`);
        if (typeof record.ai_inference_ms === 'number') parts.push(`Thời gian xử lý: ${Math.round(record.ai_inference_ms)} ms`);
        return parts.join(' • ');
    }

    function renderAiResult(record) {
        const resultCard = document.getElementById('cam-ai-result');
        const imageEl = document.getElementById('cam-ai-image');
        const behaviorEl = document.getElementById('cam-ai-behavior');
        const metaEl = document.getElementById('cam-ai-meta');
        const originalLink = document.getElementById('cam-ai-original-link');
        const lastThumb = document.getElementById('cam-last-thumb');

        if (!resultCard || !record) return;

        const displayUrl = record.annotated_image_url || record.image_url || record.original_image_url || '';
        imageEl.src = displayUrl;
        behaviorEl.textContent = BEHAVIOR_MAP[record.behavior] || record.behavior || 'Không xác định';
        metaEl.textContent = buildAiMeta(record);

        if (record.original_image_url) {
            originalLink.href = record.original_image_url;
            originalLink.hidden = false;
        } else {
            originalLink.hidden = true;
        }

        if (displayUrl && lastThumb) {
            lastThumb.innerHTML = `<img src="${displayUrl}" alt="Kết quả AI">`;
            lastThumb.classList.add('has-img');
        }

        resultCard.hidden = false;
    }

    return { renderAiResult, buildAiSummary, buildAiMeta, formatConfidence };
})();
