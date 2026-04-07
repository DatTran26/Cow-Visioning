# Phase 02 — Image API Route Tests

## Context Links
- `server.js` lines 679-927: POST /api/images, GET /api/images, PUT /api/images/:id/label, DELETE /api/images/:id
- `tests/setup.js` (created in Phase 01): mock pool, session helpers

## Overview
- **Priority**: P1
- **Status**: Completed
- **Group**: A (parallel with Phase 01, 03)
- **Description**: Write integration tests for image upload, list, label update, and delete routes

## Key Insights
- POST /api/images uses `multer` for file upload — supertest supports `.attach()` for multipart
- AI prediction is attempted during upload — must mock `requestAiPrediction` or disable AI in test env
- Routes require `authRequired` middleware — tests need session mock
- DELETE checks `user_id` ownership — test both owner and non-owner scenarios

## Requirements

### Functional
- Test POST /api/images: valid upload, missing file, missing cow_id
- Test GET /api/images: returns user's images, filter by cow_id/behavior/barn_area
- Test PUT /api/images/:id/label: valid label update, unauthorized, not found
- Test DELETE /api/images/:id: owner can delete, non-owner gets 403, not found

### Non-Functional
- Mock file system ops (no real file writes in test)
- Mock AI prediction (always return predictable result or skip)
- Test file < 200 LOC

## Related Code Files

### Create
- `tests/images.test.js` — image API tests

### Read (context only)
- `server.js` — image route implementations
- `tests/setup.js` — shared test utilities from Phase 01

## Implementation Steps

1. Create `tests/images.test.js`

2. Set up test fixtures:
   - Mock session with `userId` (inject via supertest agent with cookie or mock session middleware)
   - Mock `pool.query` responses for INSERT, SELECT, UPDATE, DELETE
   - Mock `fs.mkdirSync`, `fs.writeFileSync`, `fs.unlinkSync` to avoid file system ops
   - Set `aiSettings.AI_ENABLED = false` in test to skip AI prediction

3. Write test groups:

   **POST /api/images**:
   - Valid upload with image file + cow_id -> 200 + data object
   - Missing image file -> 400
   - Missing cow_id -> 400
   - Unauthenticated -> 401

   **GET /api/images**:
   - Returns array of user's images
   - Filters by cow_id param
   - Filters by behavior param
   - Unauthenticated -> 401

   **PUT /api/images/:id/label**:
   - Valid label update -> 200
   - Missing behavior -> 400
   - Image not found -> 404

   **DELETE /api/images/:id**:
   - Owner deletes own image -> 200
   - Non-owner -> 403
   - Not found -> 404

4. Run full test suite: `npm test`

## Todo List

- [ ] Create tests/images.test.js
- [ ] Mock file system and AI prediction
- [ ] Write POST /api/images tests (4 cases)
- [ ] Write GET /api/images tests (4 cases)
- [ ] Write PUT /api/images/:id/label tests (3 cases)
- [ ] Write DELETE /api/images/:id tests (3 cases)
- [ ] Verify all tests pass

## Success Criteria
- 14+ test cases passing
- No real files created during test execution
- Test file < 200 LOC

## Risk Assessment
| Risk | Mitigation |
|------|------------|
| Multer middleware hard to test | Use supertest `.attach('image', buffer, 'test.jpg')` |
| AI prediction side effects | Disable AI via `aiSettings.AI_ENABLED = false` in test setup |
| File cleanup in DELETE tests | Mock fs.unlinkSync, verify it was called with correct path |

## File Ownership
```
tests/images.test.js (new)
```

## Next Steps
- Phase 08 adds blog/export/admin tests, completing the suite
