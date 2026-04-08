// blog-composer.js - Composer modal, AI drafts, image handling, post submit
// Depends on: BlogUtils
// Exposed as window.BlogComposer = { init, resetComposer, openComposer, closeComposer, setEditMode }
window.BlogComposer = (() => {
    const PUBLISH_LABEL = 'Publish';
    const UPDATE_LABEL = 'Update post';

    let editingPostId = null;
    let selectedImageFile = null;
    let selectedImagePreviewUrl = null;
    let selectedGeneratedImageUrl = null;
    let selectedGeneratedImageFileName = 'ai-generated-cover.png';
    let aiDrafts = [];
    let selectedAiDraftIds = new Set();
    let _onSaved = null;

    function $(id) {
        return document.getElementById(id);
    }

    function init(onSaved) {
        _onSaved = onSaved;

        $('blog-post-form')?.addEventListener('submit', onSubmitPost);
        $('blog-cancel-edit-btn')?.addEventListener('click', resetComposer);
        $('blog-open-composer-btn')?.addEventListener('click', openComposer);
        $('blog-close-composer-btn')?.addEventListener('click', closeComposer);
        $('blog-image')?.addEventListener('change', onImageChanged);
        $('blog-title')?.addEventListener('input', renderComposerPreview);
        $('blog-content')?.addEventListener('input', renderComposerPreview);
        $('blog-image-clear-btn')?.addEventListener('click', clearSelectedImage);
        $('blog-ai-generate-btn')?.addEventListener('click', onGenerateAiDrafts);
        $('blog-ai-create-selected-btn')?.addEventListener('click', onCreateSelectedDrafts);
        $('blog-ai-suggestions')?.addEventListener('click', onSuggestionClick);
        $('blog-ai-suggestions')?.addEventListener('change', onSuggestionChange);

        const modal = $('blog-composer-modal');
        if (modal) {
            modal.addEventListener('click', (event) => {
                if (event.target === modal) closeComposer();
            });
        }

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') closeComposer();
        });

        renderComposerPreview();
        hydrateMindPrompt();
        renderAiSuggestions();
    }

    function setEditMode(postId, title, content) {
        editingPostId = postId;
        if ($('blog-title')) $('blog-title').value = title;
        if ($('blog-content')) $('blog-content').value = content;
        if ($('blog-submit-btn')) $('blog-submit-btn').textContent = UPDATE_LABEL;
        if ($('blog-cancel-edit-btn')) $('blog-cancel-edit-btn').hidden = false;
        renderComposerPreview();
        openComposer();
        $('blog-title')?.focus();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function openComposer() {
        const modal = $('blog-composer-modal');
        if (modal) modal.hidden = false;
        document.body.classList.add('modal-open');
        if (($('blog-title')?.value || '').trim()) {
            $('blog-title')?.focus();
        } else {
            $('blog-ai-prompt')?.focus();
        }
    }

    function closeComposer() {
        const modal = $('blog-composer-modal');
        if (modal) modal.hidden = true;
        document.body.classList.remove('modal-open');
    }

    async function hydrateMindPrompt() {
        const btn = $('blog-open-composer-btn');
        if (!btn) return;
        try {
            const me = typeof AppSession !== 'undefined' ? AppSession.getCurrentUser() : null;
            if (me?.username) btn.textContent = `What's on your mind today, ${me.username}?`;
        } catch (_err) {}
    }

    function getActivePreviewImageUrl() {
        return selectedImagePreviewUrl || selectedGeneratedImageUrl || '';
    }

    function renderComposerPreview() {
        const title = $('blog-title')?.value.trim() || '';
        const content = $('blog-content')?.value.trim() || '';
        const titleTarget = $('blog-preview-title');
        const contentTarget = $('blog-preview-content');
        const timeTarget = $('blog-preview-time');
        const imagesTarget = $('blog-preview-images');
        const previewImageUrl = getActivePreviewImageUrl();

        if (titleTarget) titleTarget.textContent = title || 'Post title will appear here';
        if (contentTarget) {
            contentTarget.innerHTML = BlogUtils.escapeHtml(
                content || 'Preview content will update automatically as you type.'
            ).replace(/\n/g, '<br>');
        }
        if (timeTarget) timeTarget.textContent = BlogUtils.formatTime(new Date().toISOString());

        if (imagesTarget) {
            if (previewImageUrl) {
                imagesTarget.hidden = false;
                imagesTarget.innerHTML = `<img class="blog-post-image" src="${BlogUtils.escapeHtml(previewImageUrl)}" alt="Image preview" />`;
            } else {
                imagesTarget.hidden = true;
                imagesTarget.innerHTML = '';
            }
        }
    }

    function resetComposer() {
        editingPostId = null;
        if ($('blog-title')) $('blog-title').value = '';
        if ($('blog-content')) $('blog-content').value = '';
        if ($('blog-submit-btn')) $('blog-submit-btn').textContent = PUBLISH_LABEL;
        if ($('blog-cancel-edit-btn')) $('blog-cancel-edit-btn').hidden = true;
        clearSelectedImage();
        renderComposerPreview();
        BlogUtils.setStatus('', 'info');
    }

    function setAiStatus(message, type = 'info') {
        const status = $('blog-ai-status');
        if (!status) return;
        status.textContent = message;
        status.className = `status-msg ${type}`;
    }

    function onImageChanged(event) {
        const file = event.target?.files?.[0];
        if (!file) {
            clearSelectedImage();
            return;
        }
        if (!file.type.startsWith('image/')) {
            clearSelectedImage();
            BlogUtils.setStatus('Only image files are accepted.', 'error');
            return;
        }
        if (file.size > 10 * 1024 * 1024) {
            clearSelectedImage();
            BlogUtils.setStatus('Image must be under 10 MB.', 'error');
            return;
        }

        selectedGeneratedImageUrl = null;
        selectedGeneratedImageFileName = 'ai-generated-cover.png';
        selectedImageFile = file;

        if (selectedImagePreviewUrl) URL.revokeObjectURL(selectedImagePreviewUrl);
        selectedImagePreviewUrl = URL.createObjectURL(file);

        const fileName = $('blog-image-file-name');
        const clearRow = $('blog-image-clear-row');
        if (fileName) fileName.textContent = file.name;
        if (clearRow) clearRow.hidden = false;
        renderComposerPreview();
    }

    function applyGeneratedImage(image) {
        if (!image?.image_url) return;
        selectedImageFile = null;
        if (selectedImagePreviewUrl) {
            URL.revokeObjectURL(selectedImagePreviewUrl);
            selectedImagePreviewUrl = null;
        }
        selectedGeneratedImageUrl = image.image_url;
        selectedGeneratedImageFileName = image.file_name || 'ai-generated-cover.png';

        const input = $('blog-image');
        const fileName = $('blog-image-file-name');
        const clearRow = $('blog-image-clear-row');
        if (input) input.value = '';
        if (fileName) fileName.textContent = selectedGeneratedImageFileName;
        if (clearRow) clearRow.hidden = false;
        renderComposerPreview();
    }

    function clearSelectedImage() {
        selectedImageFile = null;
        selectedGeneratedImageUrl = null;
        selectedGeneratedImageFileName = 'ai-generated-cover.png';
        if (selectedImagePreviewUrl) {
            URL.revokeObjectURL(selectedImagePreviewUrl);
            selectedImagePreviewUrl = null;
        }

        const input = $('blog-image');
        const fileName = $('blog-image-file-name');
        const clearRow = $('blog-image-clear-row');
        if (input) input.value = '';
        if (fileName) fileName.textContent = 'No image selected';
        if (clearRow) clearRow.hidden = true;
        renderComposerPreview();
    }

    function buildSuggestionCard(draft, index) {
        const isSelected = selectedAiDraftIds.has(draft.id);
        const excerpt = BlogUtils.escapeHtml(draft.excerpt || draft.content || '').replace(/\n/g, '<br>');
        const imageHtml = draft.image?.image_url
            ? `<img class="blog-ai-card-image" src="${BlogUtils.escapeHtml(draft.image.image_url)}" alt="AI suggestion image" />`
            : '';
        const note = draft.image_error
            ? `<div class="blog-ai-card-note">Image skipped: ${BlogUtils.escapeHtml(draft.image_error)}</div>`
            : '';

        return `
            <article class="blog-ai-card${isSelected ? ' is-selected' : ''}" data-draft-id="${BlogUtils.escapeHtml(draft.id)}">
                <div class="blog-ai-card-top">
                    <label class="blog-ai-card-check">
                        <input type="checkbox" data-draft-select="${BlogUtils.escapeHtml(draft.id)}" ${isSelected ? 'checked' : ''} />
                        <span>Select</span>
                    </label>
                    <span class="blog-ai-card-index">Draft ${index + 1}</span>
                </div>
                ${imageHtml}
                <h4 class="blog-ai-card-title">${BlogUtils.escapeHtml(draft.title)}</h4>
                <p class="blog-ai-card-excerpt">${excerpt}</p>
                ${note}
                <div class="blog-ai-card-actions">
                    <button type="button" class="btn btn-secondary" data-apply-draft="${BlogUtils.escapeHtml(draft.id)}">Use in form</button>
                    <button type="button" class="btn btn-link" data-toggle-draft="${BlogUtils.escapeHtml(draft.id)}">${isSelected ? 'Remove from selection' : 'Add to selection'}</button>
                </div>
            </article>
        `;
    }

    function renderAiSuggestions() {
        const wrap = $('blog-ai-suggestions-wrap');
        const list = $('blog-ai-suggestions');
        const createBtn = $('blog-ai-create-selected-btn');

        if (!wrap || !list || !createBtn) return;

        wrap.hidden = aiDrafts.length === 0;
        list.innerHTML = aiDrafts.map((draft, index) => buildSuggestionCard(draft, index)).join('');
        createBtn.disabled = selectedAiDraftIds.size === 0;
        createBtn.textContent = selectedAiDraftIds.size > 0
            ? `Create selected posts (${selectedAiDraftIds.size})`
            : 'Create selected posts';
    }

    async function onGenerateAiDrafts() {
        const prompt = $('blog-ai-prompt')?.value.trim() || '';
        const count = Number($('blog-ai-draft-count')?.value || '1');
        const includeImages = Boolean($('blog-ai-include-images')?.checked);
        const generateBtn = $('blog-ai-generate-btn');

        if (!prompt || prompt.length < 8) {
            setAiStatus('Please enter a more specific prompt for AI generation.', 'error');
            return;
        }

        if (generateBtn) {
            generateBtn.disabled = true;
            generateBtn.textContent = includeImages ? 'Generating drafts + images...' : 'Generating drafts...';
        }
        setAiStatus('AI is drafting suggestions for your blog composer...', 'info');

        try {
            const payload = await BlogUtils.fetchJson(BlogUtils.buildApiUrl('/api/blog/ai/drafts'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt, count, includeImages }),
            });
            aiDrafts = Array.isArray(payload?.data?.drafts) ? payload.data.drafts : [];
            selectedAiDraftIds = new Set();
            renderAiSuggestions();
            setAiStatus(`Generated ${aiDrafts.length} draft suggestion(s).`, 'success');
        } catch (err) {
            setAiStatus(`AI generation failed: ${err.message}`, 'error');
        } finally {
            if (generateBtn) {
                generateBtn.disabled = false;
                generateBtn.textContent = 'Generate with AI';
            }
        }
    }

    function onSuggestionClick(event) {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;

        const applyBtn = target.closest('[data-apply-draft]');
        if (applyBtn instanceof HTMLElement) {
            applyDraftToComposer(applyBtn.dataset.applyDraft || '');
            return;
        }

        const toggleBtn = target.closest('[data-toggle-draft]');
        if (toggleBtn instanceof HTMLElement) {
            toggleDraftSelection(toggleBtn.dataset.toggleDraft || '');
        }
    }

    function onSuggestionChange(event) {
        const target = event.target;
        if (!(target instanceof HTMLInputElement)) return;
        if (!target.matches('[data-draft-select]')) return;

        const draftId = target.dataset.draftSelect || '';
        if (!draftId) return;

        if (target.checked) {
            selectedAiDraftIds.add(draftId);
        } else {
            selectedAiDraftIds.delete(draftId);
        }
        renderAiSuggestions();
    }

    function toggleDraftSelection(draftId) {
        if (!draftId) return;
        if (selectedAiDraftIds.has(draftId)) {
            selectedAiDraftIds.delete(draftId);
        } else {
            selectedAiDraftIds.add(draftId);
        }
        renderAiSuggestions();
    }

    function applyDraftToComposer(draftId) {
        const draft = aiDrafts.find((item) => item.id === draftId);
        if (!draft) return;

        if ($('blog-title')) $('blog-title').value = draft.title || '';
        if ($('blog-content')) $('blog-content').value = draft.content || '';
        if (draft.image?.image_url) {
            applyGeneratedImage(draft.image);
        } else {
            clearSelectedImage();
        }

        renderComposerPreview();
        BlogUtils.setStatus('AI draft applied to the form. You can edit it before publishing.', 'success');
        $('blog-title')?.focus();
    }

    async function buildGeneratedImageFile(imageUrl, fileName) {
        const response = await fetch(imageUrl);
        if (!response.ok) {
            throw new Error('Unable to load the generated cover image');
        }
        const blob = await response.blob();
        const safeName = fileName || `ai-cover-${Date.now()}.png`;
        return new File([blob], safeName, { type: blob.type || 'image/png' });
    }

    async function uploadCurrentSelectedImage(postId) {
        if (selectedImageFile) {
            await uploadPostImage(postId, selectedImageFile);
            return;
        }
        if (selectedGeneratedImageUrl) {
            const file = await buildGeneratedImageFile(selectedGeneratedImageUrl, selectedGeneratedImageFileName);
            await uploadPostImage(postId, file);
        }
    }

    async function uploadPostImage(postId, file) {
        const fd = new FormData();
        fd.append('image', file);
        await BlogUtils.fetchJson(BlogUtils.buildApiUrl(`/api/blog/posts/${postId}/images`), { method: 'POST', body: fd });
    }

    async function createSinglePost({ title, content, image }) {
        const payload = await BlogUtils.fetchJson(BlogUtils.buildApiUrl('/api/blog/posts'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, content }),
        });
        const savedPost = payload.data || payload.post || null;
        if (image?.image_url && savedPost?.id) {
            const generatedFile = await buildGeneratedImageFile(image.image_url, image.file_name);
            await uploadPostImage(savedPost.id, generatedFile);
        }
        return savedPost;
    }

    async function onCreateSelectedDrafts() {
        const selectedDrafts = aiDrafts.filter((draft) => selectedAiDraftIds.has(draft.id));
        const actionBtn = $('blog-ai-create-selected-btn');

        if (!selectedDrafts.length) {
            setAiStatus('Select at least one AI suggestion to create posts.', 'error');
            return;
        }

        if (actionBtn) {
            actionBtn.disabled = true;
            actionBtn.textContent = 'Creating posts...';
        }
        setAiStatus(`Creating ${selectedDrafts.length} post(s) from AI suggestions...`, 'info');

        try {
            for (const draft of selectedDrafts) {
                await createSinglePost(draft);
            }
            setAiStatus(`Created ${selectedDrafts.length} post(s) successfully.`, 'success');
            if (_onSaved) await _onSaved();
        } catch (err) {
            setAiStatus(`Bulk create failed: ${err.message}`, 'error');
        } finally {
            if (actionBtn) {
                actionBtn.disabled = false;
                renderAiSuggestions();
            }
        }
    }

    async function onSubmitPost(event) {
        event.preventDefault();
        const title = $('blog-title')?.value.trim();
        const content = $('blog-content')?.value.trim();
        const submitBtn = $('blog-submit-btn');

        if (!title || !content) {
            BlogUtils.setStatus('Please enter both a title and content for the post.', 'error');
            return;
        }

        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = editingPostId ? 'Updating...' : 'Publishing...';
        }

        try {
            const payload = await BlogUtils.fetchJson(
                BlogUtils.buildApiUrl(editingPostId ? `/api/blog/posts/${editingPostId}` : '/api/blog/posts'),
                {
                    method: editingPostId ? 'PUT' : 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ title, content }),
                }
            );
            const savedPost = payload.data || payload.post || null;

            if (savedPost?.id) {
                await uploadCurrentSelectedImage(savedPost.id);
            }

            BlogUtils.setStatus(editingPostId ? 'Post updated successfully.' : 'Post published successfully.', 'success');
            resetComposer();
            closeComposer();
            if (_onSaved) await _onSaved();
        } catch (err) {
            BlogUtils.setStatus(`Error: ${err.message}`, 'error');
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = editingPostId ? UPDATE_LABEL : PUBLISH_LABEL;
            }
        }
    }

    return { init, resetComposer, openComposer, closeComposer, setEditMode };
})();
