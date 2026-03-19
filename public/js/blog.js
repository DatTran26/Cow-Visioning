const Blog = (() => {
    let editingPostId = null;

    function init() {
        const postForm = document.getElementById('blog-post-form');
        const refreshBtn = document.getElementById('blog-refresh-btn');
        const cancelBtn = document.getElementById('blog-cancel-edit-btn');
        if (postForm) postForm.addEventListener('submit', onSubmitPost);
        if (refreshBtn) refreshBtn.addEventListener('click', () => loadFeed());
        if (cancelBtn) cancelBtn.addEventListener('click', resetComposer);

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
            const response = await fetch(endpoint, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title, content }),
            });
            const payload = await response.json();
            if (!response.ok) throw new Error(payload.error || 'Khong the luu bai viet');
            setStatus(editingPostId ? 'Da cap nhat bai viet' : 'Dang bai thanh cong', 'success');
            resetComposer();
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
            const response = await fetch(`/api/blog/posts/${postId}/comments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content }),
            });
            const payload = await response.json();
            if (!response.ok) throw new Error(payload.error || 'Khong the gui comment');
            input.value = '';
            await loadFeed();
        } catch (err) {
            setStatus(`Loi comment: ${err.message}`, 'error');
        }
    }

    async function toggleLike(postId) {
        try {
            const response = await fetch(`/api/blog/posts/${postId}/likes`, { method: 'POST' });
            const payload = await response.json();
            if (!response.ok) throw new Error(payload.error || 'Khong the like bai viet');
            await loadFeed();
        } catch (err) {
            setStatus(`Loi like: ${err.message}`, 'error');
        }
    }

    async function deletePost(postId) {
        if (!window.confirm('Ban chac chan muon xoa bai viet nay?')) return;
        try {
            const response = await fetch(`/api/blog/posts/${postId}`, { method: 'DELETE' });
            const payload = await response.json();
            if (!response.ok) throw new Error(payload.error || 'Khong the xoa bai viet');
            setStatus('Da xoa bai viet', 'success');
            await loadFeed();
        } catch (err) {
            setStatus(`Loi xoa bai: ${err.message}`, 'error');
        }
    }

    async function deleteComment(commentId) {
        if (!window.confirm('Ban chac chan muon xoa comment nay?')) return;
        try {
            const response = await fetch(`/api/blog/comments/${commentId}`, { method: 'DELETE' });
            const payload = await response.json();
            if (!response.ok) throw new Error(payload.error || 'Khong the xoa comment');
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
        titleEl.focus();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    async function fetchComments(postId) {
        const response = await fetch(`/api/blog/posts/${postId}/comments`);
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || 'Khong the tai comment');
        return payload.data || [];
    }

    async function loadFeed() {
        const feed = document.getElementById('blog-feed');
        if (!feed) return;

        setStatus('Dang tai bai viet...', 'info');
        feed.innerHTML = '';

        try {
            const meRes = await fetch('/auth/me');
            const mePayload = await meRes.json();
            if (!meRes.ok) throw new Error(mePayload.error || 'Khong lay duoc user');
            const me = mePayload.user;

            const response = await fetch('/api/blog/posts?limit=30&offset=0');
            const payload = await response.json();
            if (!response.ok) throw new Error(payload.error || 'Khong tai duoc feed');

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

        const card = document.createElement('article');
        card.className = 'blog-card';
        card.dataset.postId = String(post.id);
        card.dataset.postTitle = post.title || '';
        card.dataset.postContent = post.content || '';

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
