const Blog = (() => {
    let editingPostId = null;
    let selectedImageFile = null;
    let selectedImagePreviewUrl = null;

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
            throw new Error(`Phan hoi khong hop le tu server: ${snippet}`);
        }

        if (!response.ok) {
            throw new Error(payload.error || `Request failed (${response.status})`);
        }

        return payload;
    }

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
                if (event.target === composerModal) {
                    closeComposer();
                }
            });
        }
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                closeComposer();
            }
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

    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function setStatus(msg, type) {
        const status = document.getElementById('blog-status');
        if (!status) return;
        status.textContent = msg;
        status.className = `status-msg ${type}`;
    }

    function openComposer() {
        const modal = document.getElementById('blog-composer-modal');
        if (modal) modal.hidden = false;
        document.body.classList.add('modal-open');
        const title = document.getElementById('blog-title');
        if (title) {
            title.focus();
        }
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
            const payload = await fetchJson(buildApiUrl('/auth/me'));
            const username = payload?.user?.username;
            if (username) {
                promptBtn.textContent = `What's on your mind, ${username}?`;
            }
        } catch (_err) {
            // Keep default copy when user profile is unavailable.
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
            contentTarget.innerHTML = escapeHtml(content || 'Nội dung xem trước sẽ tự động cập nhật khi bạn nhập.').replace(/\n/g, '<br>');
        }
        if (timeTarget) {
            timeTarget.textContent = formatTime(new Date().toISOString());
        }

        if (imagesTarget) {
            if (selectedImagePreviewUrl) {
                imagesTarget.hidden = false;
                imagesTarget.innerHTML = `<img class="blog-post-image" src="${escapeHtml(selectedImagePreviewUrl)}" alt="Anh bai viet xem truoc" />`;
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
        if (submit) submit.textContent = 'Dang bai';
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
            setStatus('Chi chap nhan file anh', 'error');
            return;
        }
        if (file.size > 10 * 1024 * 1024) {
            clearSelectedImage();
            setStatus('Anh toi da 10MB', 'error');
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
        if (selectedImagePreviewUrl) {
            URL.revokeObjectURL(selectedImagePreviewUrl);
        }
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
        await fetchJson(buildApiUrl(`/api/blog/posts/${postId}/images`), {
            method: 'POST',
            body: fd,
        });
    }

    function formatTime(value) {
        if (!value) return '';
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return '';
        return d.toLocaleString('vi-VN');
    }

    async function onSubmitPost(event) {
        event.preventDefault();
        const titleEl = document.getElementById('blog-title');
        const contentEl = document.getElementById('blog-content');
        const submitBtn = document.getElementById('blog-submit-btn');

        const title = titleEl ? titleEl.value.trim() : '';
        const content = contentEl ? contentEl.value.trim() : '';

        if (!title || !content) {
            setStatus('Vui long nhap tieu de va noi dung bai viet', 'error');
            return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = editingPostId ? 'Dang cap nhat...' : 'Dang dang bai...';

        try {
            const endpoint = editingPostId ? `/api/blog/posts/${editingPostId}` : '/api/blog/posts';
            const method = editingPostId ? 'PUT' : 'POST';
            const payload = await fetchJson(buildApiUrl(endpoint), {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title, content }),
            });

            const savedPost = payload.data || payload.post || null;
            if (selectedImageFile && savedPost && savedPost.id) {
                await uploadPostImage(savedPost.id, selectedImageFile);
            }

            setStatus(editingPostId ? 'Da cap nhat bai viet' : 'Dang bai thanh cong', 'success');
            resetComposer();
            closeComposer();
            await loadFeed();
        } catch (err) {
            setStatus(`Loi: ${err.message}`, 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = editingPostId ? 'Cap nhat bai viet' : 'Dang bai';
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
            await deleteComment(target.dataset.deleteComment);
            return;
        }

        if (target.matches('[data-cancel-edit]')) {
            resetComposer();
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
            await fetchJson(buildApiUrl(`/api/blog/posts/${postId}/comments`), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content }),
            });
            input.value = '';
            await loadFeed();
        } catch (err) {
            setStatus(`Loi comment: ${err.message}`, 'error');
        }
    }

    async function toggleLike(postId) {
        try {
            await fetchJson(buildApiUrl(`/api/blog/posts/${postId}/likes`), { method: 'POST' });
            await loadFeed();
        } catch (err) {
            setStatus(`Loi like: ${err.message}`, 'error');
        }
    }

    async function deletePost(postId) {
        if (!window.confirm('Ban chac chan muon xoa bai viet nay?')) return;
        try {
            await fetchJson(buildApiUrl(`/api/blog/posts/${postId}`), { method: 'DELETE' });
            setStatus('Da xoa bai viet', 'success');
            await loadFeed();
        } catch (err) {
            setStatus(`Loi xoa bai: ${err.message}`, 'error');
        }
    }

    async function deleteComment(commentId) {
        if (!window.confirm('Ban chac chan muon xoa comment nay?')) return;
        try {
            await fetchJson(buildApiUrl(`/api/blog/comments/${commentId}`), { method: 'DELETE' });
            await loadFeed();
        } catch (err) {
            setStatus(`Loi xoa comment: ${err.message}`, 'error');
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
        submit.textContent = 'Cap nhat bai viet';
        cancel.hidden = false;
        openComposer();
        titleEl.focus();
        renderComposerPreview();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    async function fetchComments(postId) {
        const payload = await fetchJson(buildApiUrl(`/api/blog/posts/${postId}/comments`));
        return payload.data || [];
    }

    async function loadFeed() {
        const feed = document.getElementById('blog-feed');
        if (!feed) return;

        setStatus('Dang tai bai viet...', 'info');
        feed.innerHTML = '';

        try {
            const mePayload = await fetchJson(buildApiUrl('/auth/me'));
            const me = mePayload.user;

            const payload = await fetchJson(buildApiUrl('/api/blog/posts?limit=30&offset=0'));

            const posts = payload.data || [];
            if (posts.length === 0) {
                feed.innerHTML = '<div class="blog-empty">Chua co bai viet nao. Hay dang bai dau tien!</div>';
                setStatus('Feed trong', 'info');
                return;
            }

            for (const post of posts) {
                const comments = await fetchComments(post.id);
                feed.appendChild(createPostCard(post, comments, me.id));
            }

            setStatus(`Da tai ${posts.length} bai viet`, 'success');
        } catch (err) {
            setStatus(`Loi tai feed: ${err.message}`, 'error');
        }
    }

    function createPostCard(post, comments, currentUserId) {
        const canManagePost = Number(post.user_id) === Number(currentUserId);
        const images = Array.isArray(post.images) ? post.images : [];

        const card = document.createElement('article');
        card.className = 'blog-card';
        card.dataset.postId = String(post.id);
        card.dataset.postTitle = post.title || '';
        card.dataset.postContent = post.content || '';

        const imagesHtml = images
            .map(
                (img) =>
                    `<img class="blog-post-image" src="${escapeHtml(img.image_url)}" alt="Anh bai viet" loading="lazy" />`
            )
            .join('');

        const commentsHtml = comments
            .map((c) => {
                const ownComment = Number(c.user_id) === Number(currentUserId);
                return `
                    <li class="blog-comment-item">
                        <div>
                            <strong>${escapeHtml(c.username)}</strong>
                            <span>${escapeHtml(formatTime(c.created_at))}</span>
                        </div>
                        <p>${escapeHtml(c.content)}</p>
                        ${ownComment ? `<button class="btn btn-link" data-delete-comment="${c.id}">Xoa</button>` : ''}
                    </li>
                `;
            })
            .join('');

        card.innerHTML = `
            <header class="blog-card-header">
                <div>
                    <h3>${escapeHtml(post.title)}</h3>
                    <p>By <strong>${escapeHtml(post.username)}</strong> · ${escapeHtml(formatTime(post.created_at))}</p>
                </div>
                <div class="blog-card-actions">
                    <button class="btn btn-secondary" data-like-post="${post.id}">
                        ${post.liked_by_me ? 'Bo like' : 'Like'} (${post.like_count || 0})
                    </button>
                    ${canManagePost ? '<button class="btn btn-secondary" data-edit-post="1">Sua</button>' : ''}
                    ${canManagePost ? '<button class="btn btn-danger" data-delete-post="1">Xoa</button>' : ''}
                </div>
            </header>
            <div class="blog-card-content">${escapeHtml(post.content).replace(/\n/g, '<br>')}</div>
            ${imagesHtml ? `<div class="blog-post-images">${imagesHtml}</div>` : ''}
            <section class="blog-comments">
                <h4>Comment (${comments.length})</h4>
                <ul class="blog-comment-list">${commentsHtml || '<li class="blog-comment-item blog-comment-empty">Chua co comment</li>'}</ul>
                <form class="blog-comment-form" data-post-id="${post.id}">
                    <input type="text" name="comment" placeholder="Viet binh luan cua ban..." maxlength="2000" required />
                    <button class="btn btn-primary" type="submit">Gui</button>
                </form>
            </section>
        `;

        return card;
    }

    return {
        init,
        loadFeed,
        resetComposer,
    };
})();
