// blog-comments.js — Comment operations for blog
// Depends on: BlogUtils
// Exposed as window.BlogComments
window.BlogComments = (() => {
    async function fetchComments(postId) {
        const payload = await BlogUtils.fetchJson(BlogUtils.buildApiUrl(`/api/blog/posts/${postId}/comments`));
        return payload.data || [];
    }

    async function submitComment(postId, content, onSuccess) {
        await BlogUtils.fetchJson(BlogUtils.buildApiUrl(`/api/blog/posts/${postId}/comments`), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content }),
        });
        if (typeof onSuccess === 'function') onSuccess();
    }

    async function deleteComment(commentId, onSuccess) {
        if (!window.confirm('Bạn có chắc muốn xóa bình luận này không?')) return;
        await BlogUtils.fetchJson(BlogUtils.buildApiUrl(`/api/blog/comments/${commentId}`), { method: 'DELETE' });
        if (typeof onSuccess === 'function') onSuccess();
    }

    return { fetchComments, submitComment, deleteComment };
})();
