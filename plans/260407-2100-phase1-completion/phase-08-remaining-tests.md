# Phase 08 — Blog, Export, and Admin API Tests

## Context Links
- `server.js` lines 929-992: blog post routes (GET/POST/PUT/DELETE)
- `server.js` lines 994-1230: blog comments, likes, images
- `server.js` lines 1274-1403: admin routes (users, AI settings, stats)
- `tests/auth.test.js` (Phase 01), `tests/images.test.js` (Phase 02) — test patterns to follow

## Overview
- **Priority**: P2
- **Status**: Completed
- **Group**: C (parallel with Group B; parallel with Phase 07)
- **Description**: Write tests for blog, admin, and remaining API routes to reach >80% route coverage

## Key Insights
- 34 total route handlers in server.js (from grep). Phase 01+02 cover ~14 (auth + images). This phase covers the remaining ~20.
- Blog routes: posts CRUD, comments CRUD, likes toggle, post images
- Admin routes: user list, role change, user delete, AI settings GET/PUT, stats
- Admin routes use `requireAdmin` middleware — tests need admin session mock
- Blog like uses UPSERT/DELETE toggle pattern

## Requirements

### Functional
- Blog posts: GET list, POST create, PUT update, DELETE
- Blog comments: GET by postId, POST create, DELETE
- Blog likes: POST toggle (like/unlike)
- Blog images: POST upload, DELETE
- Admin users: GET list, PUT role, DELETE user
- Admin AI settings: GET, PUT
- Admin stats: GET

### Non-Functional
- Test files < 200 LOC each — split into `blog.test.js` and `admin.test.js`
- Reuse mock patterns from Phase 01 setup

## Related Code Files

### Create
- `tests/blog.test.js` — blog posts, comments, likes, images tests
- `tests/admin.test.js` — admin routes tests

### Read (context only)
- `server.js` — route implementations
- `tests/setup.js` — shared test utilities

## Implementation Steps

1. **Create `tests/blog.test.js`** (~180 LOC):

   **Blog Posts:**
   - GET /api/blog/posts — returns paginated posts with like/comment counts
   - POST /api/blog/posts — creates post (title + content required)
   - POST /api/blog/posts — fails without title (400)
   - PUT /api/blog/posts/:id — updates own post
   - PUT /api/blog/posts/:id — fails for non-owner (403)
   - DELETE /api/blog/posts/:id — deletes own post

   **Blog Comments:**
   - GET /api/blog/posts/:postId/comments — returns comment list
   - POST /api/blog/posts/:postId/comments — creates comment
   - DELETE /api/blog/comments/:id — deletes own comment

   **Blog Likes:**
   - POST /api/blog/posts/:postId/likes — toggles like on/off

2. **Create `tests/admin.test.js`** (~150 LOC):

   **Admin Users:**
   - GET /admin/users — returns user list with counts (admin only)
   - GET /admin/users — rejects non-admin (403)
   - PUT /admin/users/:id/role — changes user role
   - PUT /admin/users/:id/role — prevents demoting last admin
   - DELETE /admin/users/:id — deletes user

   **Admin AI Settings:**
   - GET /admin/ai-settings — returns current AI config
   - PUT /admin/ai-settings — updates AI config
   - PUT /admin/ai-settings — rejects non-admin (403)

   **Admin Stats:**
   - GET /admin/stats — returns counts (users, images, posts)

3. **Run full suite**: `npm test` — verify all test files pass together

## Todo List

- [ ] Create tests/blog.test.js (~10 test cases)
- [ ] Create tests/admin.test.js (~9 test cases)
- [ ] Mock admin session for admin route tests
- [ ] Mock blog-related pool queries
- [ ] Verify full test suite passes: `npm test`

## Success Criteria
- 19+ additional test cases passing
- Combined with Phase 01+02: 40+ total test cases
- Route coverage: auth (4 routes) + images (4) + blog (10) + admin (6) = 24/34 routes tested
- All test files < 200 LOC

## Risk Assessment
| Risk | Mitigation |
|------|------------|
| Blog post query is complex (JOINs, subqueries) | Mock pool.query to return pre-built result rows |
| Like toggle logic hard to test in isolation | Test toggle by calling twice and checking state change |
| Admin middleware requires specific session role | Create admin session helper in setup.js |

## File Ownership
```
tests/blog.test.js (CREATE)
tests/admin.test.js (CREATE)
```

## Next Steps
- After all tests pass, run `npm test -- --coverage` to measure coverage %
- Remaining untested routes: static file serving, version endpoint (low priority)
