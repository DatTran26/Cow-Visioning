// blog-posts.js — Blog posts feed, CRUD, event routing
// Depends on: BlogUtils, BlogComments, BlogCard, BlogComposer
// Exposed as window.Blog = { init, loadFeed, resetComposer }
const Blog = (() => {
    function init() {
        BlogComposer.init(loadFeed);
        const feed = document.getElementById('blog-feed');
        if (feed) {
            feed.addEventListener('click', onFeedClick);
            feed.addEventListener('submit', onFeedSubmit);
        }
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
                feed.appendChild(BlogCard.createPostCard(post, comments, me ? me.id : null));
            }
            BlogUtils.setStatus(`Đã tải ${posts.length} bài viết.`, 'success');
        } catch (err) {
            BlogUtils.setStatus(`Lỗi khi tải bài viết: ${err.message}`, 'error');
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
        } else if (target.matches('[data-edit-post]')) {
            BlogComposer.setEditMode(postId, card.dataset.postTitle || '', card.dataset.postContent || '');
        } else if (target.matches('[data-delete-post]')) {
            await deletePost(postId);
        } else if (target.matches('[data-delete-comment]')) {
            try {
                await BlogComments.deleteComment(target.dataset.deleteComment, () => loadFeed());
            } catch (err) {
                BlogUtils.setStatus(`Lỗi khi xóa bình luận: ${err.message}`, 'error');
            }
        }
    }

    async function onFeedSubmit(event) {
        const form = event.target;
        if (!(form instanceof HTMLFormElement) || !form.matches('.blog-comment-form')) return;
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

    return { init, loadFeed, resetComposer: () => BlogComposer.resetComposer() };
})();
