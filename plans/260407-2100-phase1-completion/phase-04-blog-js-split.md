# Phase 04 — Split blog.js (488 LOC)

## Context Links
- `public/js/blog.js` — 488 LOC, IIFE module `Blog` with posts, comments, likes, images
- `public/index.html` — `<script>` tags loading order

## Overview
- **Priority**: P2
- **Status**: Completed
- **Group**: B (after Group A completes; parallel with Phase 05, 06)
- **Description**: Split blog.js into 3 focused modules under 200 LOC each

## Key Insights
- `Blog` is a single IIFE returning `{ init, loadFeed, resetComposer }`
- Internal functions cluster into 3 domains:
  1. **Posts** (CRUD, feed rendering): `init`, `loadFeed`, `createPostCard`, `onSubmitPost`, `onFeedClick`, `startEdit`, `resetComposer`, `openComposer`, `closeComposer`, `renderComposerPreview`, `hydrateMindPrompt`, `onImageChanged`, `showImagePreview`, `clearSelectedImage`, `uploadPostImage`
  2. **Comments** (fetch, submit, delete): `fetchComments`, `onFeedSubmit` (comment submission), delete comment handler inside `onFeedClick`
  3. **Shared utilities**: `buildApiUrl`, `fetchJson`, `escapeHtml`, `setStatus`, `formatTime`
- The `onFeedClick` function dispatches to likes, edits, deletes, and comment-deletes — must stay in posts or be a thin router

### Split Strategy
Rather than posts/comments/likes (which creates tight coupling since `createPostCard` builds both comment and like HTML), split by:
1. **blog-utils.js** (~40 LOC): `buildApiUrl`, `fetchJson`, `escapeHtml`, `setStatus`, `formatTime` — shared helpers
2. **blog-posts.js** (~200 LOC): `init`, CRUD, feed rendering, composer, image handling — main module
3. **blog-comments.js** (~100 LOC): `fetchComments`, comment submit handler, comment delete

Likes stay in blog-posts.js since `toggleLike` is 15 LOC and tightly coupled to card rendering.

## Requirements

### Functional
- All blog functionality preserved: post CRUD, comments, likes, image upload
- Global `Blog` object still exposes `{ init, loadFeed, resetComposer }`
- Script load order: blog-utils.js -> blog-comments.js -> blog-posts.js

### Non-Functional
- Each file < 200 LOC
- No code duplication across files
- IIFE pattern preserved (no ES modules — vanilla JS project)

## Architecture

### Module Communication
```
blog-utils.js     -> window.BlogUtils = { buildApiUrl, fetchJson, escapeHtml, setStatus, formatTime }
blog-comments.js  -> window.BlogComments = { fetchComments, submitComment, deleteComment }
blog-posts.js     -> window.Blog = { init, loadFeed, resetComposer }
                     (uses BlogUtils.* and BlogComments.*)
```

### Data Flow
- `blog-posts.js` calls `BlogComments.fetchComments(postId)` when building post cards
- `blog-posts.js` delegates comment form submission to `BlogComments.submitComment()`
- Both modules use `BlogUtils.fetchJson()` for API calls

## Related Code Files

### Delete
- `public/js/blog.js` — replaced by split files

### Create
- `public/js/blog-utils.js` — shared utilities
- `public/js/blog-comments.js` — comment operations
- `public/js/blog-posts.js` — posts, likes, composer, feed (main Blog module)

<!-- Updated: Validation Session 1 - index.html owned by Phase 09, not this phase -->

## Implementation Steps

1. **Create `public/js/blog-utils.js`** (~40 LOC):
   - Extract: `buildApiUrl`, `fetchJson`, `escapeHtml`, `setStatus`, `formatTime`
   - Expose as `window.BlogUtils` IIFE

2. **Create `public/js/blog-comments.js`** (~100 LOC):
   - Extract: `fetchComments` function
   - Create: `submitComment(postId, content)` — extracted from onFeedSubmit
   - Create: `deleteComment(commentId)` — extracted from onFeedClick
   - Use `BlogUtils.fetchJson` and `BlogUtils.buildApiUrl`
   - Expose as `window.BlogComments` IIFE

3. **Create `public/js/blog-posts.js`** (~200 LOC):
   - All remaining blog logic: init, composer, post CRUD, likes, feed rendering
   - Replace internal calls: `fetchJson` -> `BlogUtils.fetchJson`, etc.
   - Import comments: `BlogComments.fetchComments(postId)`
   - Delegate comment events to BlogComments
   - Expose as `window.Blog = { init, loadFeed, resetComposer }`

4. **Delete `public/js/blog.js`**
   *(index.html script tag updates are handled by Phase 09 — do not touch index.html)*

6. **Browser smoke test**: verify blog tab renders posts, comments work, likes toggle

## Todo List

- [ ] Create public/js/blog-utils.js (extract shared helpers)
- [ ] Create public/js/blog-comments.js (extract comment CRUD)
- [ ] Create public/js/blog-posts.js (remaining blog logic)
- [ ] Delete public/js/blog.js (index.html updated by Phase 09)
- [ ] Verify all 3 files < 200 LOC
- [ ] Browser smoke test: posts, comments, likes, image upload

## Success Criteria
- `blog-utils.js` < 50 LOC
- `blog-comments.js` < 120 LOC
- `blog-posts.js` < 200 LOC
- Blog tab fully functional in browser
- `window.Blog.init`, `window.Blog.loadFeed`, `window.Blog.resetComposer` all work

## Risk Assessment
| Risk | Mitigation |
|------|------------|
| Script load order wrong | blog-utils first, then comments, then posts |
| Closure variable (editingPostId, selectedImageFile) scope lost | Keep closure vars in blog-posts.js IIFE |
| DOMPurify integration from Phase 03 breaks | Phase 03 patches blog.js; this phase splits the patched version |

## File Ownership
```
public/js/blog.js (DELETE)
public/js/blog-utils.js (CREATE)
public/js/blog-comments.js (CREATE)
public/js/blog-posts.js (CREATE)
// public/index.html — owned by Phase 09, do not touch
```

## Next Steps
- Phase 09 handles remaining file splits (upload, session, app)
- index.html script tag changes must be coordinated with Phase 05 and 06
