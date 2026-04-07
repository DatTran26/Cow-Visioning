// blog-card.js — Post card HTML rendering
// Depends on: BlogUtils
// Exposed as window.BlogCard = { createPostCard }
window.BlogCard = (() => {
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

    return { createPostCard };
})();
