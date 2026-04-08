// blog-card.js — Post card HTML rendering with reaction picker
// Depends on: BlogUtils
// Exposed as window.BlogCard = { createPostCard }
window.BlogCard = (() => {
    function getInitials(username) {
        if (!username) return '?';
        return username.charAt(0).toUpperCase();
    }

    function renderReactionSummary(summary, totalReactions) {
        const badges = BlogUtils.getReactionBadges(summary, 3);
        const iconHtml = badges.length > 0
            ? badges.map((item) => `<span class="blog-reaction-badge" title="${BlogUtils.escapeHtml(item.label)}">${item.emoji}</span>`).join('')
            : '<span class="blog-reaction-badge is-empty">👍</span>';

        return `
            <div class="blog-reaction-summary">
                <div class="blog-reaction-badges">${iconHtml}</div>
                <span>${totalReactions} reaction${totalReactions === 1 ? '' : 's'}</span>
            </div>
        `;
    }

    function renderReactionPicker(currentReaction, isAuthenticated) {
        if (!isAuthenticated) return '';

        const optionsHtml = BlogUtils.getReactionCatalog()
            .map((reaction) => `
                <button
                    type="button"
                    class="blog-reaction-option${currentReaction === reaction.type ? ' is-selected' : ''}"
                    data-reaction-option="${reaction.type}"
                    title="${BlogUtils.escapeHtml(reaction.label)}"
                    aria-label="${BlogUtils.escapeHtml(reaction.label)}"
                >${reaction.emoji}</button>
            `)
            .join('');

        return `<div class="blog-reaction-picker" role="toolbar" aria-label="Post reactions">${optionsHtml}</div>`;
    }

    function createPostCard(post, comments, currentUserId) {
        const isAuthenticated = currentUserId != null;
        const canManagePost = isAuthenticated && Number(post.user_id) === Number(currentUserId);
        const images = Array.isArray(post.images) ? post.images : [];
        const initials = getInitials(post.username);
        const authorName = post.username || 'Anonymous';
        const currentReaction = typeof post.current_reaction === 'string' ? post.current_reaction : '';
        const reactionMeta = BlogUtils.getReactionMeta(currentReaction || 'like');
        const reactionLabel = currentReaction ? reactionMeta.label : 'React';
        const reactionIcon = currentReaction ? reactionMeta.emoji : '👍';
        const reactionSummary = BlogUtils.normalizeReactionSummary(post.reaction_summary);
        const totalReactions = Number(post.like_count || 0);

        const card = document.createElement('article');
        card.className = 'blog-card';
        card.dataset.postId = String(post.id);
        card.dataset.postTitle = post.title || '';
        card.dataset.postContent = post.content || '';
        card.dataset.authorId = String(post.user_id || '');
        card.dataset.authorName = authorName;

        const imagesHtml = images
            .map((img) => `<img class="blog-post-image" src="${BlogUtils.escapeHtml(img.image_url)}" alt="Post image" loading="lazy" />`)
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
                        ${ownComment ? `<button class="btn btn-link" data-delete-comment="${comment.id}">Delete comment</button>` : ''}
                    </li>
                `;
            })
            .join('');

        const postActionsHtml = canManagePost ? `
            <details class="blog-post-menu">
                <summary
                    class="blog-post-menu-trigger"
                    aria-label="Post actions"
                    title="Post actions"
                >
                    <span class="blog-post-menu-dots" aria-hidden="true">•••</span>
                </summary>
                <div class="blog-post-menu-list">
                    <button type="button" class="blog-post-menu-item" data-edit-post="1">Edit</button>
                    <button type="button" class="blog-post-menu-item is-danger" data-delete-post="1">Delete</button>
                </div>
            </details>
        ` : '';

        const rawHtml = `
            <div class="blog-card-inner">
                <header class="blog-card-header">
                    <div class="blog-card-header-left">
                        <div class="blog-card-byline">
                            <div class="blog-card-author-avatar">${BlogUtils.escapeHtml(initials)}</div>
                            <div>
                                <h3>${BlogUtils.escapeHtml(post.title)}</h3>
                                <p>
                                    By
                                    <button
                                        type="button"
                                        class="blog-card-author-link"
                                        data-open-profile="${BlogUtils.escapeHtml(String(post.user_id || ''))}"
                                        data-author-name="${BlogUtils.escapeHtml(authorName)}"
                                    >${BlogUtils.escapeHtml(authorName)}</button>
                                    &bull;
                                    ${BlogUtils.escapeHtml(BlogUtils.formatTime(post.created_at))}
                                </p>
                            </div>
                        </div>
                    </div>
                    <div class="blog-card-actions">
                        ${postActionsHtml}
                    </div>
                </header>
                <div class="blog-card-content">${BlogUtils.escapeHtml(post.content).replace(/\n/g, '<br>')}</div>
                ${imagesHtml ? `<div class="blog-post-images">${imagesHtml}</div>` : ''}
            </div>
            <div class="blog-card-footer-area">
                <div class="blog-post-meta-row">
                    ${renderReactionSummary(reactionSummary, totalReactions)}
                    <span class="blog-post-meta-count">${comments.length} comment${comments.length === 1 ? '' : 's'}</span>
                </div>
                <div class="blog-post-toolbar">
                    <div class="blog-reaction-control">
                        <button
                            type="button"
                            class="blog-post-action blog-post-reaction-trigger${currentReaction ? ' is-active' : ''}"
                            data-reaction-button="${post.id}"
                            data-current-reaction="${BlogUtils.escapeHtml(currentReaction)}"
                            ${!isAuthenticated ? 'disabled title="Log in to react"' : ''}
                        >
                            <span class="blog-post-action-icon">${reactionIcon}</span>
                            <span>${BlogUtils.escapeHtml(reactionLabel)}</span>
                        </button>
                        ${renderReactionPicker(currentReaction, isAuthenticated)}
                    </div>
                    <button type="button" class="blog-post-action" data-focus-comment="${post.id}">
                        <span class="blog-post-action-icon">💬</span>
                        <span>Comment</span>
                    </button>
                    <button type="button" class="blog-post-action" disabled title="Share is coming soon">
                        <span class="blog-post-action-icon">↗</span>
                        <span>Share</span>
                    </button>
                </div>
                <section class="blog-comments">
                    <h4>Comments (${comments.length})</h4>
                    <ul class="blog-comment-list">${commentsHtml || '<li class="blog-comment-item blog-comment-empty">No comments yet.</li>'}</ul>
                    ${isAuthenticated ? `
                    <form class="blog-comment-form" data-post-id="${post.id}">
                        <input type="text" name="comment" placeholder="Write a comment..." maxlength="2000" required />
                        <button class="btn btn-primary" type="submit">Post comment</button>
                    </form>
                    ` : `<p style="font-size:13px;color:var(--muted);margin-top:8px;">Log in to interact and comment.</p>`}
                </section>
            </div>
        `;

        card.innerHTML = typeof DOMPurify !== 'undefined'
            ? DOMPurify.sanitize(rawHtml, {
                ADD_TAGS: ['form', 'details', 'summary'],
                ADD_ATTR: [
                    'data-post-id',
                    'data-edit-post',
                    'data-delete-post',
                    'data-delete-comment',
                    'data-open-profile',
                    'data-author-name',
                    'data-reaction-button',
                    'data-current-reaction',
                    'data-reaction-option',
                    'data-focus-comment',
                ],
            })
            : rawHtml;

        return card;
    }

    return { createPostCard };
})();
