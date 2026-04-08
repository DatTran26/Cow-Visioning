// camera-ai-display.js - AI result rendering for camera tab
// Exposes window.CameraAI = { renderAiResult, buildAiSummary, buildAiMeta, formatConfidence }
// Note: BEHAVIOR_MAP is defined in api-config.js as window.BEHAVIOR_MAP
window.CameraAI = (() => {
    function formatConfidence(value) {
        return typeof value === 'number' ? `${(value * 100).toFixed(1)}%` : '';
    }

    function buildAiSummary(record) {
        const label = BEHAVIOR_MAP[record.behavior] || record.behavior || 'unknown';
        const confidence = formatConfidence(record.ai_confidence);
        return confidence ? `AI detected: ${label} (${confidence})` : `AI detected: ${label}`;
    }

    function buildAiMeta(record) {
        const parts = [];
        const confidence = formatConfidence(record.ai_confidence);
        if (confidence) parts.push(`Confidence: ${confidence}`);
        if (typeof record.detection_count === 'number') parts.push(`Detections: ${record.detection_count}`);
        if (typeof record.ai_inference_ms === 'number') parts.push(`Processing time: ${Math.round(record.ai_inference_ms)} ms`);
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
        if (!AiDisplay.hasAiResult(record)) {
            hideAiResult();
            return;
        }

        const displayUrl = record.annotated_image_url || record.image_url || record.original_image_url || '';
        imageEl.src = displayUrl;
        behaviorEl.textContent = BEHAVIOR_MAP[record.behavior] || record.behavior || 'Unknown';
        metaEl.innerHTML = AiDisplay.buildAiMetaMarkup(record);

        if (record.original_image_url) {
            originalLink.href = record.original_image_url;
            originalLink.hidden = false;
        } else {
            originalLink.hidden = true;
        }

        if (displayUrl && lastThumb) {
            lastThumb.innerHTML = `<img src="${displayUrl}" alt="AI result">`;
            lastThumb.classList.add('has-img');
        }

        resultCard.hidden = false;
    }

    function hideAiResult() {
        const resultCard = document.getElementById('cam-ai-result');
        const imageEl = document.getElementById('cam-ai-image');
        const metaEl = document.getElementById('cam-ai-meta');
        const originalLink = document.getElementById('cam-ai-original-link');

        if (!resultCard) return;
        resultCard.hidden = true;
        if (imageEl) imageEl.src = '';
        if (metaEl) metaEl.innerHTML = '';
        if (originalLink) {
            originalLink.hidden = true;
            originalLink.removeAttribute('href');
        }
    }

    return { renderAiResult, buildAiSummary, buildAiMeta, formatConfidence, hideAiResult };
})();
