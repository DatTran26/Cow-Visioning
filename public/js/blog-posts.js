// blog-posts.js — Blog feed, profile view, CRUD, event routing
// Depends on: BlogUtils, BlogComments, BlogCard, BlogComposer, AppSession
// Exposed as window.Blog = { init, loadFeed, resetComposer, openProfile, closeProfile }
const Blog = (() => {
    const DEFAULT_LIMIT = 30;
    let currentView = { type: 'feed', userId: null, userName: '' };

    function init() {
        BlogComposer.init(() => loadFeed(currentView));

        document.getElementById('blog-feed')?.addEventListener('click', onFeedClick);
        document.getElementById('blog-feed')?.addEventListener('submit', onFeedSubmit);
        document.getElementById('blog-profile-feed')?.addEventListener('click', onFeedClick);
        document.getElementById('blog-profile-feed')?.addEventListener('submit', onFeedSubmit);
        document.addEventListener('click', onDocumentClick);

        document.querySelector('.blog-profile-badge')?.addEventListener('click', onOpenOwnProfile);
        document.getElementById('blog-profile-back-btn')?.addEventListener('click', closeProfile);
        document.getElementById('blog-refresh-btn')?.addEventListener('click', () => loadFeed(currentView));

        document.querySelectorAll('[data-blog-shortcut]').forEach((shortcut) => {
            shortcut.addEventListener('click', () => handleShortcut(shortcut.dataset.blogShortcut));
        });
    }

    function getCurrentUser() {
        return typeof AppSession !== 'undefined' ? AppSession.getCurrentUser() : null;
    }

    function normalizeView(view) {
        if (view && view.type === 'profile' && view.userId != null) {
            return {
                type: 'profile',
                userId: String(view.userId),
                userName: view.userName || '',
            };
        }
        return { type: 'feed', userId: null, userName: '' };
    }

    function getViewElements() {
        return {
            quickCreate: document.getElementById('blog-quick-create'),
            profileView: document.getElementById('blog-profile-view'),
            mainFeedSection: document.getElementById('blog-main-feed-section'),
            mainFeed: document.getElementById('blog-feed'),
            profileFeed: document.getElementById('blog-profile-feed'),
        };
    }

    function toggleView(view) {
        const { quickCreate, profileView, mainFeedSection } = getViewElements();
        const isProfile = view.type === 'profile';

        if (quickCreate) quickCreate.hidden = isProfile;
        if (profileView) profileView.hidden = !isProfile;
        if (mainFeedSection) mainFeedSection.hidden = isProfile;
    }

    async function loadFeed(view = { type: 'feed' }) {
        const normalizedView = normalizeView(view);
        currentView = normalizedView;
        toggleView(normalizedView);

        const { mainFeed, profileFeed } = getViewElements();
        const targetFeed = normalizedView.type === 'profile' ? profileFeed : mainFeed;
        if (!targetFeed) return;

        const currentUser = getCurrentUser();
        BlogUtils.setStatus(normalizedView.type === 'profile' ? 'Loading profile...' : 'Loading posts...', 'info');
        targetFeed.innerHTML = '';

        if (normalizedView.type === 'feed' && profileFeed) {
            profileFeed.innerHTML = '';
        }
        if (normalizedView.type === 'profile' && mainFeed) {
            mainFeed.innerHTML = '';
        }

        try {
            const params = new URLSearchParams({
                limit: String(DEFAULT_LIMIT),
                offset: '0',
            });
            if (normalizedView.type === 'profile') {
                params.set('all', '1');
                params.set('userId', normalizedView.userId);
            }

            const payload = await BlogUtils.fetchJson(BlogUtils.buildApiUrl(`/api/blog/posts?${params.toString()}`));
            const posts = Array.isArray(payload.data) ? payload.data : [];
            const postsWithComments = await Promise.all(
                posts.map(async (post) => ({
                    post,
                    comments: await BlogComments.fetchComments(post.id),
                }))
            );

            if (postsWithComments.length === 0) {
                renderEmptyState(targetFeed, normalizedView);
            } else {
                for (const item of postsWithComments) {
                    targetFeed.appendChild(
                        BlogCard.createPostCard(item.post, item.comments, currentUser ? currentUser.id : null)
                    );
                }
            }

            if (normalizedView.type === 'profile') {
                renderProfileSummary(normalizedView, posts, payload.meta || {}, currentUser);
            }
            BlogUtils.setStatus('', 'info');
        } catch (err) {
            BlogUtils.setStatus(`Error loading posts: ${err.message}`, 'error');
            renderLoadError(targetFeed);
        }
    }

    function renderEmptyState(targetFeed, view) {
        const isProfile = view.type === 'profile';
        const authorName = view.userName || 'This author';
        targetFeed.innerHTML = isProfile
            ? `<div class="blog-empty">${BlogUtils.escapeHtml(authorName)} has not published any posts yet.</div>`
            : '<div class="blog-empty">No posts yet. Be the first to create one!</div>';

        if (isProfile) {
            renderProfileSummary(view, [], { total: 0 }, getCurrentUser());
        }
    }

    function renderLoadError(targetFeed) {
        targetFeed.innerHTML = '<div class="blog-empty">Unable to load content right now. Please try again.</div>';
    }

    function renderProfileSummary(view, posts, meta, currentUser) {
        const profileTitle = document.getElementById('blog-profile-title');
        const profileSubtitle = document.getElementById('blog-profile-subtitle');
        const profileAvatar = document.getElementById('blog-profile-avatar');
        const postsHeading = document.getElementById('blog-profile-posts-heading');
        const postCount = document.getElementById('blog-profile-post-count');
        const likeCount = document.getElementById('blog-profile-like-count');
        const commentCount = document.getElementById('blog-profile-comment-count');

        const fallbackName = Number(view.userId) === Number(currentUser?.id) ? currentUser?.username : '';
        const authorName = view.userName || posts[0]?.username || fallbackName || 'Author';
        const isOwnProfile = Number(view.userId) === Number(currentUser?.id);
        const totalPosts = Number.isFinite(meta.total) ? meta.total : posts.length;
        const totalLikes = posts.reduce((sum, post) => sum + Number(post.like_count || 0), 0);
        const totalComments = posts.reduce((sum, post) => sum + Number(post.comment_count || 0), 0);

        if (profileTitle) profileTitle.textContent = authorName;
        if (profileAvatar) profileAvatar.textContent = authorName.charAt(0).toUpperCase();
        if (postsHeading) {
            postsHeading.textContent = isOwnProfile
                ? 'All posts you have published'
                : `All posts published by ${authorName}`;
        }
        if (profileSubtitle) {
            profileSubtitle.textContent = isOwnProfile
                ? 'Your personal space in Cow Visioning. Every article, update, and field note you publish is collected here.'
                : `${authorName}'s public activity stream inside Cow Visioning.`;
        }
        if (postCount) postCount.textContent = String(totalPosts);
        if (likeCount) likeCount.textContent = String(totalLikes);
        if (commentCount) commentCount.textContent = String(totalComments);
    }

    function openProfile(userId, userName = '') {
        if (!userId) return;
        return loadFeed({ type: 'profile', userId, userName });
    }

    function closeProfile() {
        return loadFeed({ type: 'feed' });
    }

    function handleShortcut(shortcut) {
        if (shortcut === 'my-posts') {
            const currentUser = getCurrentUser();
            if (currentUser?.id) {
                openProfile(currentUser.id, currentUser.username || '');
            }
            return;
        }

        if (shortcut === 'saved' || shortcut === 'followed') {
            BlogUtils.setStatus('This shortcut will be upgraded next. My posts is ready now.', 'info');
        }
    }

    function onOpenOwnProfile(event) {
        event.preventDefault();
        const currentUser = getCurrentUser();
        if (!currentUser?.id) return;
        openProfile(currentUser.id, currentUser.username || '');
    }

    async function onFeedClick(event) {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;

        const clickedMenu = target.closest('.blog-post-menu');
        if (!(clickedMenu instanceof HTMLElement)) {
            closeOpenPostMenus();
        }

        const profileTrigger = target.closest('[data-open-profile]');
        if (profileTrigger instanceof HTMLElement) {
            const userId = profileTrigger.dataset.openProfile;
            const userName = profileTrigger.dataset.authorName || profileTrigger.textContent || '';
            if (userId) {
                event.preventDefault();
                await openProfile(userId, userName.trim());
            }
            return;
        }

        const card = target.closest('.blog-card');
        if (!card) return;
        const postId = card.dataset.postId;

        const reactionOption = target.closest('[data-reaction-option]');
        if (reactionOption instanceof HTMLElement) {
            await reactToPost(postId, reactionOption.dataset.reactionOption || 'like');
        } else if (target.closest('[data-reaction-button]') instanceof HTMLElement) {
            const reactionButton = target.closest('[data-reaction-button]');
            await reactToPost(postId, reactionButton?.dataset.currentReaction || 'like');
        } else if (target.closest('[data-focus-comment]') instanceof HTMLElement) {
            const commentInput = card.querySelector('.blog-comment-form input[name="comment"]');
            if (commentInput instanceof HTMLInputElement) {
                commentInput.focus();
                commentInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        } else if (target.closest('[data-edit-post]') instanceof HTMLElement) {
            target.closest('.blog-post-menu')?.removeAttribute('open');
            BlogComposer.setEditMode(postId, card.dataset.postTitle || '', card.dataset.postContent || '');
        } else if (target.closest('[data-delete-post]') instanceof HTMLElement) {
            target.closest('.blog-post-menu')?.removeAttribute('open');
            await deletePost(postId);
        } else if (target.matches('[data-delete-comment]')) {
            try {
                await BlogComments.deleteComment(target.dataset.deleteComment, () => loadFeed(currentView));
            } catch (err) {
                BlogUtils.setStatus(`Error deleting comment: ${err.message}`, 'error');
            }
        }
    }

    function closeOpenPostMenus(exceptMenu = null) {
        document.querySelectorAll('.blog-post-menu[open]').forEach((menu) => {
            if (exceptMenu && menu === exceptMenu) return;
            menu.removeAttribute('open');
        });
    }

    function onDocumentClick(event) {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        const activeMenu = target.closest('.blog-post-menu');
        closeOpenPostMenus(activeMenu instanceof HTMLElement ? activeMenu : null);
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
                await loadFeed(currentView);
            });
        } catch (err) {
            BlogUtils.setStatus(`Error submitting comment: ${err.message}`, 'error');
        }
    }

    async function reactToPost(postId, reactionType) {
        try {
            await BlogUtils.fetchJson(BlogUtils.buildApiUrl(`/api/blog/posts/${postId}/likes`), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reaction_type: reactionType || 'like' }),
            });
            await loadFeed(currentView);
        } catch (err) {
            BlogUtils.setStatus(`Error updating reaction: ${err.message}`, 'error');
        }
    }

    async function deletePost(postId) {
        if (!window.confirm('Are you sure you want to delete this post?')) return;
        try {
            await BlogUtils.fetchJson(BlogUtils.buildApiUrl(`/api/blog/posts/${postId}`), { method: 'DELETE' });
            BlogUtils.setStatus('Post deleted.', 'success');
            await loadFeed(currentView);
        } catch (err) {
            BlogUtils.setStatus(`Error deleting post: ${err.message}`, 'error');
        }
    }

    return {
        init,
        loadFeed,
        resetComposer: () => BlogComposer.resetComposer(),
        openProfile,
        closeProfile,
    };
})();
