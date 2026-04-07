# Cattle Action: Development Roadmap

**Last Updated**: 2026-04-08  
**Current Phase**: Phase 1 (Complete)

---

## Executive Summary

Phase 1 complete: Core codebase modularization, security hardening, test suite, and schema groundwork.
- 50/50 tests passing
- All frontend modules refactored below 200 LOC
- DOMPurify XSS protection integrated
- farm_id multi-tenancy columns added to schema

---

## Phase 1: Modularization & Testing (COMPLETE)

**Status**: ✅ COMPLETE (2026-04-07 → 2026-04-08)  
**Effort**: 12h  
**Branch**: `develop`

### Deliverables

| ID | Task | Status | LOC Impact |
|----|------|--------|-----------|
| 01 | Jest config + auth tests (12 tests) | ✅ | +350 |
| 02 | Image API tests (11 tests) | ✅ | +280 |
| 03 | .env.example + DOMPurify XSS fix | ✅ | +140 |
| 04 | blog.js → 5 modules (blog-utils, blog-comments, blog-card, blog-composer, blog-posts) | ✅ | -488 LOC → +414 LOC |
| 05 | camera.js → 3 modules (camera-ai-display, camera-capture, camera-init) | ✅ | -470 LOC → +440 LOC |
| 06 | admin.js → 2 modules (admin-users, admin-panel) | ✅ | -228 LOC → +243 LOC |
| 07 | farm_id migration (4 tables: cow_images, users, blog_posts, app_config) | ✅ | schema updated |
| 08 | Blog + admin API tests (27 tests) | ✅ | +560 |
| 09 | upload.js, session.js, app.js refactored (ai-display-helpers, session-ui, app-helpers) | ✅ | -632 LOC → +550 LOC |

### Success Criteria Met

- [x] `npm test` passes: 50/50 tests across 4 test files
- [x] All `public/js/` files < 200 LOC (max: 198 LOC)
- [x] .env.example documents 21+ environment variables
- [x] XSS protection: DOMPurify integrated with CDN + SRI
- [x] farm_id schema support: nullable columns + indexes
- [x] Browser smoke test: all tabs functional (no regressions)

### Architecture Changes

**Frontend Module Split**
```
Before Phase 1:          After Phase 1:
blog.js (488 LOC)    →   blog-utils.js (52)
camera.js (470 LOC)  →   blog-comments.js (26)
admin.js (228 LOC)   →   blog-posts.js (99)
upload.js (218 LOC)  →   blog-card.js (74)
session.js (206 LOC) →   blog-composer.js (163)
app.js (208 LOC)     →   camera-ai-display.js (55)
                         camera-capture.js (187)
                         camera-init.js (198)
                         admin-users.js (101)
                         admin-panel.js (142)
                         upload.js (191)
                         session-ui.js (80)
                         session.js (130)
                         app.js (120)
                         app-helpers.js (90)
                         ai-display-helpers.js (50)
```

**Test Suite Established**
- `tests/auth.test.js`: Auth routes (12 tests)
- `tests/images.test.js`: Image API (11 tests)
- `tests/blog.test.js`: Blog operations (14 tests)
- `tests/admin.test.js`: Admin routes (13 tests)
- Coverage: 50+ assertions across 34 endpoints

**Security Hardening**
- DOMPurify CDN integration (v3.1.6) with integrity hash
- XSS sanitization in blog post rendering
- .env.example eliminates credential exposure risk

**Schema Evolution**
- farm_id VARCHAR(100) NULL on 4 tables
- Indexes created for query optimization
- Backward compatible (nullable columns)

---

## Phase 2: Multi-Tenancy & API v2 (PLANNED)

**Estimated**: 2026-04-15 → 2026-05-01  
**Effort**: 16h

### Focus Areas
- Create `farms` table + foreign key constraints
- Add farm isolation to all queries (WHERE farm_id = ?)
- Implement farm admin role + member assignment
- API v2 endpoints with farm context
- Farm switching UI in sidebar

### Dependencies
- Phase 1 must complete (✅ DONE)
- schema.sql farm_id columns (✅ DONE)

---

## Phase 3: Advanced Features (BACKLOG)

**Estimated**: 2026-05-01 → 2026-06-15

### Candidates
- Bulk image upload with progress tracking
- AI model version management
- Historical behavior trending dashboard
- Export reports (PDF/CSV) with farm filters
- Mobile-optimized UI

---

## Risk Register

| Risk | Status | Mitigation |
|------|--------|-----------|
| Jest test flakiness with PG pool | CLOSED | Real test DB via TEST_DATABASE_URL |
| Script load order breaking with splits | CLOSED | IIFE pattern + explicit load order in index.html |
| farm_id migration on live DB | CLOSED | Idempotent SQL, nullable columns |
| DOMPurify CDN unavailable | MITIGATED | Graceful fallback with `typeof DOMPurify !== 'undefined'` |

---

## Metrics

### Code Health
- **Frontend Modularity**: 18 modules, all < 200 LOC (down from 6 monolithic files)
- **Test Coverage**: 50 tests, ~80% route coverage
- **Build Time**: No regression (vanilla JS, no build step)
- **Bundle Size**: Slight increase from splits (~2KB), negligible impact

### Performance
- **Frontend Load**: Parallel script execution via IIFE modules
- **Session Startup**: Test DB setup < 500ms
- **AI Integration**: No changes (Phase 1 keeps async unchanged)

---

## Documentation Index

- [System Architecture](system-architecture.md) — 4-layer design
- [Code Standards](code-standards.md) — Frontend/backend conventions
- [Project Changelog](project-changelog.md) — Detailed change log by feature

---

## Contacts & Ownership

- **Phase 1 Execution**: AI Assistant team
- **Code Review**: Human lead
- **Deployment**: GitHub Actions CI/CD

---

## Next Action

**Immediate** (Ready now):
- Merge Phase 1 branch to `main`
- Tag release v0.2.0 (Post-modularization)
- Deploy to staging VPS

**Next Session**:
- Begin Phase 2 planning (farm isolation)
