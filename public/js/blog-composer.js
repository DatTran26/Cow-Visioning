// blog-composer.js — Composer modal, image handling, post submit
// Depends on: BlogUtils
// Exposed as window.BlogComposer = { init, resetComposer, openComposer, closeComposer, setEditMode }
window.BlogComposer = (() => {
    let editingPostId = null;
    let selectedImageFile = null;
    let selectedImagePreviewUrl = null;
    let _onSaved = null;

    function init(onSaved) {
        _onSaved = onSaved;
        const $ = (id) => document.getElementById(id);
        $('blog-post-form')?.addEventListener('submit', onSubmitPost);
        $('blog-cancel-edit-btn')?.addEventListener('click', resetComposer);
        $('blog-open-composer-btn')?.addEventListener('click', openComposer);
        $('blog-close-composer-btn')?.addEventListener('click', closeComposer);
        const modal = $('blog-composer-modal');
        if (modal) modal.addEventListener('click', (e) => { if (e.target === modal) closeComposer(); });
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeComposer(); });
        $('blog-image')?.addEventListener('change', onImageChanged);
        $('blog-title')?.addEventListener('input', renderComposerPreview);
        $('blog-content')?.addEventListener('input', renderComposerPreview);
        $('blog-image-clear-btn')?.addEventListener('click', clearSelectedImage);
        renderComposerPreview();
        hydrateMindPrompt();
    }

    function setEditMode(postId, title, content) {
        editingPostId = postId;
        const $ = (id) => document.getElementById(id);
        if ($('blog-title')) $('blog-title').value = title;
        if ($('blog-content')) $('blog-content').value = content;
        if ($('blog-submit-btn')) $('blog-submit-btn').textContent = 'Cập nhật bài viết';
        if ($('blog-cancel-edit-btn')) $('blog-cancel-edit-btn').hidden = false;
        renderComposerPreview();
        openComposer();
        $('blog-title')?.focus();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function openComposer() {
        const modal = document.getElementById('blog-composer-modal');
        if (modal) modal.hidden = false;
        document.body.classList.add('modal-open');
        document.getElementById('blog-title')?.focus();
    }

    function closeComposer() {
        const modal = document.getElementById('blog-composer-modal');
        if (modal) modal.hidden = true;
        document.body.classList.remove('modal-open');
    }

    async function hydrateMindPrompt() {
        const btn = document.getElementById('blog-open-composer-btn');
        if (!btn) return;
        try {
            const me = typeof AppSession !== 'undefined' ? AppSession.getCurrentUser() : null;
            if (me?.username) btn.textContent = `Bạn muốn chia sẻ điều gì hôm nay, ${me.username}?`;
        } catch (_err) {}
    }

    function renderComposerPreview() {
        const title = document.getElementById('blog-title')?.value.trim() || '';
        const content = document.getElementById('blog-content')?.value.trim() || '';
        const titleTarget = document.getElementById('blog-preview-title');
        const contentTarget = document.getElementById('blog-preview-content');
        const timeTarget = document.getElementById('blog-preview-time');
        const imagesTarget = document.getElementById('blog-preview-images');
        if (titleTarget) titleTarget.textContent = title || 'Tiêu đề bài viết sẽ hiển thị ở đây';
        if (contentTarget) {
            contentTarget.innerHTML = BlogUtils.escapeHtml(content || 'Nội dung xem trước sẽ tự động cập nhật khi bạn nhập.').replace(/\n/g, '<br>');
        }
        if (timeTarget) timeTarget.textContent = BlogUtils.formatTime(new Date().toISOString());
        if (imagesTarget) {
            if (selectedImagePreviewUrl) {
                imagesTarget.hidden = false;
                imagesTarget.innerHTML = `<img class="blog-post-image" src="${BlogUtils.escapeHtml(selectedImagePreviewUrl)}" alt="Ảnh xem trước" />`;
            } else {
                imagesTarget.hidden = true;
                imagesTarget.innerHTML = '';
            }
        }
    }

    function resetComposer() {
        editingPostId = null;
        const title = document.getElementById('blog-title');
        const content = document.getElementById('blog-content');
        const submit = document.getElementById('blog-submit-btn');
        const cancel = document.getElementById('blog-cancel-edit-btn');
        if (title) title.value = '';
        if (content) content.value = '';
        if (submit) submit.textContent = 'Đăng bài viết';
        if (cancel) cancel.hidden = true;
        clearSelectedImage();
        renderComposerPreview();
    }

    function onImageChanged(event) {
        const file = event.target?.files?.[0];
        if (!file) { clearSelectedImage(); return; }
        if (!file.type.startsWith('image/')) { clearSelectedImage(); BlogUtils.setStatus('Chỉ chấp nhận tệp ảnh.', 'error'); return; }
        if (file.size > 10 * 1024 * 1024) { clearSelectedImage(); BlogUtils.setStatus('Ảnh tối đa 10 MB.', 'error'); return; }
        selectedImageFile = file;
        const previewWrap = document.getElementById('blog-image-preview');
        const previewImg = document.getElementById('blog-image-preview-img');
        if (!previewWrap || !previewImg) return;
        if (selectedImagePreviewUrl) URL.revokeObjectURL(selectedImagePreviewUrl);
        selectedImagePreviewUrl = URL.createObjectURL(file);
        previewImg.src = selectedImagePreviewUrl;
        previewWrap.hidden = false;
        renderComposerPreview();
    }

    function clearSelectedImage() {
        selectedImageFile = null;
        if (selectedImagePreviewUrl) { URL.revokeObjectURL(selectedImagePreviewUrl); selectedImagePreviewUrl = null; }
        const input = document.getElementById('blog-image');
        const previewWrap = document.getElementById('blog-image-preview');
        const previewImg = document.getElementById('blog-image-preview-img');
        if (input) input.value = '';
        if (previewImg) previewImg.src = '';
        if (previewWrap) previewWrap.hidden = true;
        renderComposerPreview();
    }

    async function uploadPostImage(postId, file) {
        const fd = new FormData();
        fd.append('image', file);
        await BlogUtils.fetchJson(BlogUtils.buildApiUrl(`/api/blog/posts/${postId}/images`), { method: 'POST', body: fd });
    }

    async function onSubmitPost(event) {
        event.preventDefault();
        const title = document.getElementById('blog-title')?.value.trim();
        const content = document.getElementById('blog-content')?.value.trim();
        const submitBtn = document.getElementById('blog-submit-btn');
        if (!title || !content) { BlogUtils.setStatus('Vui lòng nhập đầy đủ tiêu đề và nội dung bài viết.', 'error'); return; }
        submitBtn.disabled = true;
        submitBtn.textContent = editingPostId ? 'Đang cập nhật...' : 'Đang đăng bài...';
        try {
            const payload = await BlogUtils.fetchJson(BlogUtils.buildApiUrl(editingPostId ? `/api/blog/posts/${editingPostId}` : '/api/blog/posts'), {
                method: editingPostId ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title, content }),
            });
            const savedPost = payload.data || payload.post || null;
            if (selectedImageFile && savedPost?.id) await uploadPostImage(savedPost.id, selectedImageFile);
            BlogUtils.setStatus(editingPostId ? 'Đã cập nhật bài viết.' : 'Đăng bài thành công.', 'success');
            resetComposer();
            closeComposer();
            if (_onSaved) await _onSaved();
        } catch (err) {
            BlogUtils.setStatus(`Lỗi: ${err.message}`, 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = editingPostId ? 'Cập nhật bài viết' : 'Đăng bài viết';
        }
    }

    return { init, resetComposer, openComposer, closeComposer, setEditMode };
})();
