# Phase 03 — .env.example + XSS Fix in blog.js

## Context Links
- `server.js` lines 19-112: all `process.env.*` references (21 env vars)
- `public/js/blog.js` line 452: `card.innerHTML = ...` with post.content
- `public/js/blog.js` line 466: `escapeHtml(post.content).replace(/\n/g, '<br>')` — uses escapeHtml but the rendered HTML still uses innerHTML

## Overview
- **Priority**: P1 (security fix)
- **Status**: Completed
- **Group**: A (parallel with Phase 01, 02)
- **Description**: Create .env.example documenting all env vars; fix XSS vulnerability in blog feed rendering

## Key Insights

### XSS Analysis
The blog.js `createPostCard()` function at line 452 uses `card.innerHTML = ...` to build post cards. While it does use `escapeHtml()` on user content (line 466: `escapeHtml(post.content).replace(/\n/g, '<br>')`), the custom `escapeHtml` function is basic and the `innerHTML` approach is inherently risky. The scout flagged `blog.content rendered via innerHTML` as a vulnerability.

**Current escapeHtml** (line 74-81): Replaces `&`, `<`, `>`, `"`, `'` — this is reasonable but does not handle all edge cases. Using DOMPurify as an additional layer provides defense-in-depth.

### Env Vars Inventory (21 total)
From `server.js` grep of `process.env.*`:
1. PORT, 2. DB_HOST, 3. DB_PORT, 4. DB_NAME, 5. DB_USER, 6. DB_PASSWORD,
7. NODE_ENV, 8. PUBLIC_API_BASE_URL, 9. CORS_ALLOWED_ORIGINS,
10. SESSION_COOKIE_SAMESITE, 11. SESSION_COOKIE_SECURE, 12. IMAGE_BASE_URL,
13. UPLOAD_DIR, 14. AI_SERVICE_URL, 15. AI_TIMEOUT_MS,
16. AI_EMBED_IMAGE_PAYLOAD, 17. SESSION_SECRET,
18. AI_DEVICE, 19. AI_CONF_THRESHOLD, 20. AI_IOU_THRESHOLD,
21. AI_MAX_DET, 22. AI_ENABLED, 23. AI_MODEL_NAME

## Requirements

### Functional
- `.env.example` lists every env var with description, type, default, and example
- blog.js XSS hardened with DOMPurify CDN for innerHTML content

### Non-Functional
- .env.example must NOT contain real credentials
- DOMPurify loaded via CDN `<script>` tag (no npm — frontend is vanilla JS)

## Related Code Files

### Create
- `.env.example` — env var documentation

### Modify
- `public/index.html` — add DOMPurify CDN script tag
- `public/js/blog.js` — wrap innerHTML content through DOMPurify.sanitize()

## Implementation Steps

1. **Create `.env.example`** with all 23 env vars grouped by category:
   ```env
   # === Server ===
   PORT=3000
   NODE_ENV=development

   # === Database (PostgreSQL) ===
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=cow_visioning
   DB_USER=cowapp
   DB_PASSWORD=your_password_here

   # === Session ===
   SESSION_SECRET=change-me-to-a-long-random-string
   SESSION_COOKIE_SAMESITE=lax
   SESSION_COOKIE_SECURE=false

   # === CORS ===
   CORS_ALLOWED_ORIGINS=

   # === URLs ===
   PUBLIC_API_BASE_URL=
   IMAGE_BASE_URL=

   # === Uploads ===
   UPLOAD_DIR=./uploads

   # === AI Service ===
   AI_SERVICE_URL=http://127.0.0.1:8001
   AI_TIMEOUT_MS=20000
   AI_EMBED_IMAGE_PAYLOAD=false
   AI_ENABLED=true
   AI_DEVICE=cpu
   AI_CONF_THRESHOLD=0.25
   AI_IOU_THRESHOLD=0.45
   AI_MAX_DET=50
   AI_MODEL_NAME=
   ```

2. **Add DOMPurify CDN** to `public/index.html` before app scripts:
   ```html
   <script src="https://cdnjs.cloudflare.com/ajax/libs/dompurify/3.1.6/purify.min.js"
           integrity="sha384-..." crossorigin="anonymous"></script>
   ```

3. **Patch blog.js `createPostCard()`** — wrap the innerHTML assignment:
   - Before: `card.innerHTML = \`...\`;`
   - After: `card.innerHTML = typeof DOMPurify !== 'undefined' ? DOMPurify.sanitize(\`...\`, { ADD_TAGS: ['form'], ADD_ATTR: ['data-post-id', 'data-like-post', 'data-edit-post', 'data-delete-post', 'data-delete-comment'] }) : \`...\`;`
   - DOMPurify config must allow `data-*` attributes and `<form>` tags used in comment forms

4. **Verify** blog still renders correctly in browser after DOMPurify integration.

## Todo List

- [ ] Create .env.example with all 23 env vars documented
- [ ] Add DOMPurify CDN to public/index.html
- [ ] Patch blog.js createPostCard() to use DOMPurify.sanitize()
- [ ] Verify blog feed renders correctly in browser
- [ ] Verify .env.example has no real credentials

## Success Criteria
- `.env.example` exists with all env vars from server.js
- `DOMPurify.sanitize()` wraps all innerHTML assignments in blog.js that render user content
- Blog post cards render identically (visual regression: none)
- No real secrets in .env.example

## Risk Assessment
| Risk | Mitigation |
|------|------------|
| DOMPurify strips data-* attributes needed for event delegation | Configure `ADD_ATTR` allowlist |
| DOMPurify strips `<form>` tags in comment section | Configure `ADD_TAGS: ['form']` |
| CDN unavailable offline | Graceful fallback: `typeof DOMPurify !== 'undefined' ? ... : raw` |
| Missing env var in .env.example | Cross-reference grep of `process.env` in server.js |

## Security Considerations
- DOMPurify prevents stored XSS via blog post content injection
- escapeHtml() remains as first-line defense; DOMPurify is defense-in-depth
- .env.example uses placeholder values only

## File Ownership
```
.env.example (new)
public/index.html (DOMPurify script tag only)
public/js/blog.js (sanitize wrapper in createPostCard only — no structural changes)
```

## Next Steps
- Phase 04 will split blog.js into smaller modules (after this XSS fix is in place)
