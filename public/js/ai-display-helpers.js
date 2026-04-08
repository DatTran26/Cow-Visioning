// ai-display-helpers.js - Shared AI display utilities (upload + camera + gallery)
// Exposed as window.AiDisplay.
window.AiDisplay = (() => {
    let publicSettings = {
        AI_ENABLED: true,
        AI_TOOL_PRO_ENABLED: false,
    };

    function setPublicSettings(nextSettings) {
        publicSettings = {
            ...publicSettings,
            ...(nextSettings || {}),
        };
    }

    function isToolProFeatureEnabled() {
        return Boolean(publicSettings.AI_TOOL_PRO_ENABLED);
    }

    function isYoloActive() {
        return Boolean(publicSettings.AI_ENABLED);
    }

    function isToolProActive() {
        return Boolean(publicSettings.AI_TOOL_PRO_ENABLED);
    }

    function formatConfidence(value) {
        return typeof value === 'number' ? `${(value * 100).toFixed(1)}%` : '';
    }

    function hasAiResult(record) {
        return Boolean(
            record
            && record.ai_status === 'completed'
            && (record.annotated_image_url || typeof record.ai_confidence === 'number')
        );
    }

    function getAiProviderLabel(record) {
        const provider = String(record?.ai_provider || '').toLowerCase();
        if (provider === 'tool_pro') return 'Tool Pro';
        if (provider === 'yolo') return 'YOLO';
        if (provider === 'manual' || record?.ai_status === 'manual') return 'Manual';
        return 'AI';
    }

    function buildAiSummary(record, prefix) {
        const label = BEHAVIOR_MAP[record.behavior] || record.behavior || 'unknown';
        const confidence = formatConfidence(record.ai_confidence);
        const summaryPrefix = prefix || 'AI detected';
        return confidence
            ? `${summaryPrefix}: ${label} (${confidence})`
            : `${summaryPrefix}: ${label}`;
    }

    function buildAiMeta(record) {
        const parts = [];
        const confidence = formatConfidence(record.ai_confidence);
        if (confidence) parts.push(`Confidence: ${confidence}`);
        if (typeof record.detection_count === 'number') parts.push(`Detections: ${record.detection_count}`);
        if (typeof record.ai_inference_ms === 'number') parts.push(`Processing time: ${Math.round(record.ai_inference_ms)} ms`);
        return parts.join(' • ');
    }

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function buildAiMetaItems(record) {
        const items = [];
        const providerLabel = getAiProviderLabel(record);
        const confidence = formatConfidence(record.ai_confidence);

        if (providerLabel) items.push({ label: 'Mode', value: providerLabel });
        if (confidence) items.push({ label: 'Confidence', value: confidence });
        if (typeof record.detection_count === 'number') items.push({ label: 'Detections', value: record.detection_count });
        if (typeof record.ai_inference_ms === 'number') items.push({ label: 'Processing Time', value: `${Math.round(record.ai_inference_ms)} ms` });

        return items;
    }

    function buildAiMetaMarkup(record) {
        return buildAiMetaItems(record)
            .map((item) => [
                '<div class="ai-result-meta-item">',
                `<span class="ai-result-meta-label">${escapeHtml(item.label)}</span>`,
                `<span class="ai-result-meta-value">${escapeHtml(item.value)}</span>`,
                '</div>',
            ].join(''))
            .join('');
    }

    function buildAiStateMessage(record, requestedMode = 'manual') {
        const mode = String(requestedMode || '').toLowerCase();
        const providerLabel = getAiProviderLabel(record);

        if (hasAiResult(record)) {
            return buildAiSummary(record, providerLabel);
        }
        if (record?.ai_status === 'failed') {
            return `Saved image, but ${providerLabel} could not process it.`;
        }
        if (mode === 'yolo' && !isYoloActive()) {
            return 'Saved image without YOLO analysis.';
        }
        if (mode === 'tool_pro' && !isToolProActive()) {
            return 'Saved image without Tool Pro analysis.';
        }
        return 'Saved image without AI analysis.';
    }

    return {
        buildAiMeta,
        buildAiMetaItems,
        buildAiMetaMarkup,
        buildAiSummary,
        buildAiStateMessage,
        formatConfidence,
        getAiProviderLabel,
        hasAiResult,
        isYoloActive,
        isToolProActive,
        isToolProFeatureEnabled,
        setPublicSettings,
    };
})();
