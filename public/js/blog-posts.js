// blog-posts.js — Posts, likes, composer, feed
// Depends on: BlogUtils, BlogComments
// Exposed as window.Blog = { init, loadFeed, resetComposer }
const Blog = (() => {
    let editingPostId = null;
    let selectedImageFile = null;
    let selectedImagePreviewUrl = null;

    function init() {
        const postForm = document.getElementById('blog-post-form');
        const composerModal = document.getElementById('blog-composer-modal');
        const refreshBtn = document.getElementById('blog-refresh-btn');
        const cancelBtn = document.getElementById('blog-cancel-edit-btn');
        const openComposerBtn = document.getElementById('blog-open-composer-btn');
        const closeComposerBtn = document.getElementById('blog-close-composer-btn');
        const imageInput = document.getElementById('blog-image');
        const titleInput = document.getElementById('blog-title');
        const contentInput = document.getElementById('blog-content');
        const clearImageBtn = document.getElementById('blog-image-clear-btn');

        if (postForm) postForm.addEventListener('submit', onSubmitPost);
        if (refreshBtn) refreshBtn.addEventListener('click', () => loadFeed());
        if (cancelBtn) cancelBtn.addEventListener('click', resetComposer);
        if (openComposerBtn) openComposerBtn.addEventListener('click', openComposer);
        if (closeComposerBtn) closeComposerBtn.addEventListener('click', closeComposer);
        if (composerModal) {
            composerModal.addEventListener('click', (event) => {
                if (event.target === composerModal) closeComposer();
            });
        }
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') closeComposer();
        });
        if (imageInput) imageInput.addEventListener('change', onImageChanged);
        if (titleInput) titleInput.addEventListener('input', renderComposerPreview);
        if (contentInput) contentInput.addEventListener('input', renderComposerPreview);
        if (clearImageBtn) clearImageBtn.addEventListener('click', clearSelectedImage);

        renderComposerPreview();
        hydrateMindPrompt();

        const feed = document.getElementById('blog-feed');
        if (feed) {
            feed.addEventListener('click', onFeedClick);
            feed.addEventListener('submit', onFeedSubmit);
        }
    }

    function openComposer() {
        const modal = document.getElementById('blog-composer-modal');
        if (modal) modal.hidden = false;
        document.body.classList.add('modal-open');
        const title = document.getElementById('blog-title');
        if (title) title.focus();
    }

    function closeComposer() {
        const modal = document.getElementById('blog-composer-modal');
        if (modal) modal.hidden = true;
        document.body.classList.remove('modal-open');
    }

    async function hydrateMindPrompt() {
        const promptBtn = document.getElementById('blog-open-composer-btn');
        if (!promptBtn) return;
        try {
            const me = typeof AppSession !== 'undefined' ? AppSession.getCurrentUser() : null;
            const username = me?.username;
            if (username) {
                promptBtn.textContent = `Bạn muốn chia sẻ điều gì hôm nay, ${username}?`;
            }
        } catch (_err) {
            // Giữ nguyên nội dung mặc định.
        }
    }

    function renderComposerPreview() {
        const titleInput = document.getElementById('blog-title');
        const contentInput = document.getElementById('blog-content');
        const titleTarget = document.getElementById('blog-preview-title');
        const contentTarget = document.getElementById('blog-preview-content');
        const timeTarget = document.getElementById('blog-preview-time');
        const imagesTarget = document.getElementById('blog-preview-images');

        const title = titleInput ? titleInput.value.trim() : '';
        const content = contentInput ? contentInput.value.trim() : '';

        if (titleTarget) {
            titleTarget.textContent = title || 'Tiêu đề bài viết sẽ hiển thị ở đây';
        }
        if (contentTarget) {
            contentTarget.innerHTML = BlogUtils.escapeHtml(content || 'Nội dung xem trước sẽ tự động cập nhật khi bạn nhập.').replace(/\n/g, '<br>');
        }
        if (timeTarget) {
            timeTarget.textContent = BlogUtils.formatTime(new Date().toISOString());
        }
        if (imagesTarget) {
            if (selectedImagePreviewUrl) {
                imagesTarget.hidden = false;
                imagesTarget.innerHTML = `<img class="blog-post-image" src="${BlogUtils.escapeHtml(selectedImagePreviewUrl)}" alt="Ảnh bài viết xem trước" />`;
            } else {
                imagesTarget.hidden = true;
                imagesTarget.innerHTML = '';
            }
        }
    }

    function resetComposer() {
        const title = document.getElementById('blog-title');
        const content = document.getElementById('blog-content');
        const submit = document.getElementById('blog-submit-btn');
        const cancel = document.getElementById('blog-cancel-edit-btn');
        editingPostId = null;
        if (title) title.value = '';
        if (content) content.value = '';
        if (submit) submit.textContent = 'Đăng bài viết';
        if (cancel) cancel.hidden = true;
        clearSelectedImage();
        renderComposerPreview();
    }

    function onImageChanged(event) {
        const input = event.target;
        if (!(input instanceof HTMLInputElement) || !input.files || input.files.length === 0) {
            clearSelectedImage();
            return;
        }
        const file = input.files[0];
        if (!file.type.startsWith('image/')) {
            clearSelectedImage();
            BlogUtils.setStatus('Chỉ chấp nhận tệp ảnh.', 'error');
            return;
        }
        if (file.size > 10 * 1024 * 1024) {
            clearSelectedImage();
            BlogUtils.setStatus('Ảnh tối đa 10 MB.', 'error');
            return;
        }
        selectedImageFile = file;
        showImagePreview(file);
    }

    function showImagePreview(file) {
        const previewWrap = document.getElementById('blog-image-preview');
        const previewImg = document.getElementById('blog-image-preview-img');
        if (!previewWrap || !previewImg) return;
        const objectUrl = URL.createObjectURL(file);
        if (selectedImagePreviewUrl) URL.revokeObjectURL(selectedImagePreviewUrl);
        selectedImagePreviewUrl = objectUrl;
        previewImg.src = objectUrl;
        previewWrap.hidden = false;
        renderComposerPreview();
    }

    function clearSelectedImage() {
        selectedImageFile = null;
        const input = document.getElementById('blog-image');
        const previewWrap = document.getElementById('blog-image-preview');
        const previewImg = document.getElementById('blog-image-preview-img');
        if (selectedImagePreviewUrl) {
            URL.revokeObjectURL(selectedImagePreviewUrl);
            selectedImagePreviewUrl = null;
        }
        if (input) input.value = '';
        if (previewImg) previewImg.src = '';
        if (previewWrap) previewWrap.hidden = true;
        renderComposerPreview();
    }

    async function uploadPostImage(postId, file) {
        const fd = new FormData();
        fd.append('image', file);
        await BlogUtils.fetchJson(BlogUtils.buildApiUrl(`/api/blog/posts/${postId}/images`), {
            method: 'POST',
            body: fd,
        });
    }

    async function onSubmitPost(event) {
        event.preventDefault();
        const titleEl = document.getElementById('blog-title');
        const contentEl = document.getElementById('blog-content');
        const submitBtn = document.getElementById('blog-submit-btn');

        const title = titleEl ? titleEl.value.trim() : '';
        const content = contentEl ? contentEl.value.trim() : '';

        if (!title || !content) {
            BlogUtils.setStatus('Vui lòng nhập đầy đủ tiêu đề và nội dung bài viết.', 'error');
            return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = editingPostId ? 'Đang cập nhật...' : 'Đang đăng bài...';

        try {
            const endpoint = editingPostId ? `/api/blog/posts/${editingPostId}` : '/api/blog/posts';
            const method = editingPostId ? 'PUT' : 'POST';
            const payload = await BlogUtils.fetchJson(BlogUtils.buildApiUrl(endpoint), {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title, content }),
            });

            const savedPost = payload.data || payload.post || null;
            if (selectedImageFile && savedPost && savedPost.id) {
                await uploadPostImage(savedPost.id, selectedImageFile);
            }

            BlogUtils.setStatus(editingPostId ? 'Đã cập nhật bài viết.' : 'Đăng bài thành công.', 'success');
            resetComposer();
            closeComposer();
            await loadFeed();
        } catch (err) {
            BlogUtils.setStatus(`Lỗi: ${err.message}`, 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = editingPostId ? 'Cập nhật bài viết' : 'Đăng bài viết';
        }
    }

    async function onFeedClick(event) {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;

        const card = target.closest('.blog-card');
        if (!card) return;
        const postId = card.dataset.postId;

        if (target.matches('[data-like-post]')) {
            await toggleLike(postId);
            return;
        }
        if (target.matches('[data-edit-post]')) {
            startEdit(card);
            return;
        }
        if (target.matches('[data-delete-post]')) {
            await deletePost(postId);
            return;
        }
        if (target.matches('[data-delete-comment]')) {
            try {
                await BlogComments.deleteComment(target.dataset.deleteComment, () => loadFeed());
            } catch (err) {
                BlogUtils.setStatus(`Lỗi khi xóa bình luận: ${err.message}`, 'error');
            }
        }
    }

    async function onFeedSubmit(event) {
        const form = event.target;
        if (!(form instanceof HTMLFormElement)) return;
        if (!form.matches('.blog-comment-form')) return;

        event.preventDefault();
        const postId = form.dataset.postId;
        const input = form.querySelector('input[name="comment"]');
        const content = input ? input.value.trim() : '';
        if (!content) return;

        try {
            await BlogComments.submitComment(postId, content, async () => {
                if (input) input.value = '';
                await loadFeed();
            });
        } catch (err) {
            BlogUtils.setStatus(`Lỗi khi gửi bình luận: ${err.message}`, 'error');
        }
    }

    async function toggleLike(postId) {
        try {
            await BlogUtils.fetchJson(BlogUtils.buildApiUrl(`/api/blog/posts/${postId}/likes`), { method: 'POST' });
            await loadFeed();
        } catch (err) {
            BlogUtils.setStatus(`Lỗi khi bày tỏ quan tâm: ${err.message}`, 'error');
        }
    }

    async function deletePost(postId) {
        if (!window.confirm('Bạn có chắc muốn xóa bài viết này không?')) return;
        try {
            await BlogUtils.fetchJson(BlogUtils.buildApiUrl(`/api/blog/posts/${postId}`), { method: 'DELETE' });
            BlogUtils.setStatus('Đã xóa bài viết.', 'success');
            await loadFeed();
        } catch (err) {
            BlogUtils.setStatus(`Lỗi khi xóa bài viết: ${err.message}`, 'error');
        }
    }

    function startEdit(card) {
        const postId = card.dataset.postId;
        const title = card.dataset.postTitle || '';
        const content = card.dataset.postContent || '';

        const titleEl = document.getElementById('blog-title');
        const contentEl = document.getElementById('blog-content');
        const submit = document.getElementById('blog-submit-btn');
        const cancel = document.getElementById('blog-cancel-edit-btn');

        editingPostId = postId;
        titleEl.value = title;
        contentEl.value = content;
        submit.textContent = 'Cập nhật bài viết';
        cancel.hidden = false;
        openComposer();
        titleEl.focus();
        renderComposerPreview();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    async function loadFeed() {
        const feed = document.getElementById('blog-feed');
        if (!feed) return;

        BlogUtils.setStatus('Đang tải danh sách bài viết...', 'info');
        feed.innerHTML = '';

        try {
            const me = typeof AppSession !== 'undefined' ? AppSession.getCurrentUser() : null;
            const payload = await BlogUtils.fetchJson(BlogUtils.buildApiUrl('/api/blog/posts?limit=30&offset=0'));

            const posts = payload.data || [];
            if (posts.length === 0) {
                feed.innerHTML = '<div class="blog-empty">Chưa có bài viết nào. Hãy tạo bài viết đầu tiên.</div>';
                BlogUtils.setStatus('Chưa có bài viết nào trong hệ thống.', 'info');
                return;
            }

            for (const post of posts) {
                const comments = await BlogComments.fetchComments(post.id);
                feed.appendChild(createPostCard(post, comments, me ? me.id : null));
            }

            BlogUtils.setStatus(`Đã tải ${posts.length} bài viết.`, 'success');
        } catch (err) {
            BlogUtils.setStatus(`Lỗi khi tải bài viết: ${err.message}`, 'error');
        }
    }

    function createPostCard(post, comments, currentUserId) {
        const isAuthenticated = currentUserId != null;
        const canManagePost = isAuthenticated && Number(post.user_id) === Number(currentUserId);
        const images = Array.isArray(post.images) ? post.images : [];

        const card = document.createElement('article');
        card.className = 'blog-card';
        card.dataset.postId = String(post.id);
        card.dataset.postTitle = post.title || '';
        card.dataset.postContent = post.content || '';

        const imagesHtml = images
            .map((img) => `<img class="blog-post-image" src="${BlogUtils.escapeHtml(img.image_url)}" alt="Ảnh bài viết" loading="lazy" />`)
            .join('');

        const commentsHtml = comments
            .map((comment) => {
                const ownComment = isAuthenticated && Number(comment.user_id) === Number(currentUserId);
                return `
                    <li class="blog-comment-item">
                        <div>
                            <strong>${BlogUtils.escapeHtml(comment.username || 'Anonymous')}</strong>
                            <span>${BlogUtils.escapeHtml(BlogUtils.formatTime(comment.created_at))}</span>
                        </div>
                        <p>${BlogUtils.escapeHtml(comment.content)}</p>
                        ${ownComment ? `<button class="btn btn-link" data-delete-comment="${comment.id}">Xóa bình luận</button>` : ''}
                    </li>
                `;
            })
            .join('');

        const rawHtml = `
            <header class="blog-card-header">
                <div>
                    <h3>${BlogUtils.escapeHtml(post.title)}</h3>
                    <p>Bởi <strong>${BlogUtils.escapeHtml(post.username || 'Anonymous')}</strong> • ${BlogUtils.escapeHtml(BlogUtils.formatTime(post.created_at))}</p>
                </div>
                <div class="blog-card-actions">
                    <button class="btn btn-secondary" data-like-post="${post.id}" ${!isAuthenticated ? 'disabled title="Đăng nhập để quan tâm"' : ''}>
                        ${post.liked_by_me ? 'Bỏ quan tâm' : 'Quan tâm'} (${post.like_count || 0})
                    </button>
                    ${canManagePost ? '<button class="btn btn-secondary" data-edit-post="1">Sửa</button>' : ''}
                    ${canManagePost ? '<button class="btn btn-danger" data-delete-post="1">Xóa</button>' : ''}
                </div>
            </header>
            <div class="blog-card-content">${BlogUtils.escapeHtml(post.content).replace(/\n/g, '<br>')}</div>
            ${imagesHtml ? `<div class="blog-post-images">${imagesHtml}</div>` : ''}
            <section class="blog-comments">
                <h4>Bình luận (${comments.length})</h4>
                <ul class="blog-comment-list">${commentsHtml || '<li class="blog-comment-item blog-comment-empty">Chưa có bình luận nào.</li>'}</ul>
                ${isAuthenticated ? `
                <form class="blog-comment-form" data-post-id="${post.id}">
                    <input type="text" name="comment" placeholder="Viết bình luận của bạn..." maxlength="2000" required />
                    <button class="btn btn-primary" type="submit">Gửi bình luận</button>
                </form>
                ` : `<p style="font-size: 0.85rem; color: var(--t3); margin-top: 1rem;">Đăng nhập để tương tác và bình luận.</p>`}
            </section>
        `;
        card.innerHTML = typeof DOMPurify !== 'undefined'
            ? DOMPurify.sanitize(rawHtml, {
                ADD_TAGS: ['form'],
                ADD_ATTR: ['data-post-id', 'data-like-post', 'data-edit-post', 'data-delete-post', 'data-delete-comment'],
            })
            : rawHtml;

        return card;
    }

    return { init, loadFeed, resetComposer };
})();
