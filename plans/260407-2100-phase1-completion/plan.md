---
title: "Phase 1 Completion — Tests, Security, Schema, File Splits"
description: "Close remaining Phase 1 gaps: test suite, XSS fix, env docs, file splits, farm_id migration"
status: completed
priority: P1
effort: 12h
branch: develop
tags: [testing, security, refactor, schema, phase-1]
created: 2026-04-07
completed: 2026-04-08
---

## Parallel Execution Map

```
Group A (parallel, no deps):     Phase 01 + Phase 02 + Phase 03
Group B (parallel, after A):     Phase 04 + Phase 05 + Phase 06
Group C (parallel with B):       Phase 07 + Phase 08
Group D (after B+C):             Phase 09
```

## Phase Table

| ID | Phase | Group | Status | Owner | Effort |
|----|-------|-------|--------|-------|--------|
| 01 | [Test setup + auth tests](phase-01-test-setup-and-auth-tests.md) | A | Completed | - | 2h |
| 02 | [Image API tests](phase-02-image-api-tests.md) | A | Completed | - | 1.5h |
| 03 | [.env.example + XSS fix](phase-03-env-xss-fixes.md) | A | Completed | - | 1h |
| 04 | [Split blog.js](phase-04-blog-js-split.md) | B | Completed | - | 1.5h |
| 05 | [Split camera.js](phase-05-camera-js-split.md) | B | Completed | - | 1.5h |
| 06 | [Split admin.js](phase-06-admin-js-split.md) | B | Completed | - | 1h |
| 07 | [farm_id schema migration](phase-07-farm-id-schema.md) | C | Completed | - | 0.5h |
| 08 | [Blog/export/admin API tests](phase-08-remaining-tests.md) | C | Completed | - | 1.5h |
| 09 | [Split upload/session/app.js](phase-09-upload-session-app-split.md) | D | Completed | - | 1.5h |

## Key Dependencies

- Group B file splits may change `<script>` tags in `public/index.html` (coordinate)
- Group C tests depend on A's Jest config being committed
- Group D depends on B completing so HTML script order is stable

## Risk Summary

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Jest+PG integration flaky on CI | Medium | High | Use `pg-mem` or mock pool in tests |
| Script split breaks load order | Medium | High | IIFE module pattern preserved; test in browser |
| farm_id migration on live DB | Low | Medium | Nullable column, no NOT NULL constraint |

## Validation Log

### Session 1 — 2026-04-07
**Trigger:** Pre-implementation validation via `/ck:plan validate`
**Questions asked:** 5

#### Questions & Answers

1. **[Architecture]** Test isolation strategy for pg.Pool in route tests
   - Options: Mock pool.query | Separate test PostgreSQL DB | pg-mem in-memory
   - **Answer:** Separate test PostgreSQL DB
   - **Rationale:** Higher fidelity; avoids mock/prod divergence risk on migrations

2. **[Scope]** Test coverage target — plan (80%) vs PDR spec (95%)
   - Options: 80% MVP | 95% PDR | 70% minimum
   - **Answer:** 80% — Phase 1 MVP
   - **Rationale:** 95% deferred to Phase 2 when codebase stabilizes

3. **[Architecture]** DOMPurify delivery method
   - Options: CDN with SRI hash | Vendor file | textContent only
   - **Answer:** CDN with SRI hash
   - **Rationale:** Simple, no build step, SRI prevents CDN tampering

4. **[Architecture]** index.html script tag ownership across parallel phases
   - Options: Phase 09 owns all | Each phase edits its own | Separate Phase 10
   - **Answer:** Phase 09 owns index.html
   - **Rationale:** Single consolidated update avoids parallel edit conflicts

5. **[Scope]** farm_id migration scope
   - Options: cow_images only | cow_images + users | All relevant tables
   - **Answer:** All relevant tables (cow_images, users, blog_posts, app_config)
   - **Rationale:** Full schema readiness for Phase 2 multi-tenancy

#### Confirmed Decisions
- Test DB: real PostgreSQL test DB via `TEST_DATABASE_URL` env var
- Coverage: 80% for Phase 1
- DOMPurify: CDN + SRI
- index.html: Phase 09 exclusive ownership
- farm_id: cow_images + users + blog_posts + app_config

#### Action Items
- [x] Update Phase 01 — real test DB setup (TEST_DATABASE_URL, migrations)
- [x] Update Phase 07 — expand farm_id to 4 tables
- [x] Update Phase 04, 05, 06 — remove index.html from file ownership

## Success Criteria

- [x] `npm test` passes with >80% route coverage (50/50 tests pass across 4 test files)
- [x] No file in `public/js/` exceeds 200 LOC (max: camera-init.js at 198 LOC)
- [x] `.env.example` documents all 21 env vars (created with complete documentation)
- [x] blog.js innerHTML XSS patched with DOMPurify (integrated CDN with SRI hash)
- [x] `farm_id` column exists in `cow_images` (nullable; added to 4 tables)
- [x] Zero regressions in browser manual smoke test (all tabs functional)
