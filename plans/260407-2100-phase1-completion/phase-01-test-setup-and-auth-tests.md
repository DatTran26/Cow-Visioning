# Phase 01 — Test Setup + Auth Route Tests

## Context Links
- `server.js` lines 494-653: auth routes (register, login, me, logout)
- `package.json`: current deps (no test framework)
- `schema.sql`: users table definition

## Overview
- **Priority**: P1 (blocking — all other test phases depend on this config)
- **Status**: Completed
- **Group**: A (parallel with Phase 02, 03)
- **Description**: Install Jest + supertest, configure test DB connection, write auth route integration tests

## Key Insights
- server.js exports nothing — `app.listen()` is inline at EOF. Must refactor to export `app` for supertest.
- Auth routes use bcrypt (slow in tests), rate limiter (must disable/reset in test), and PG sessions.
- Rate limiter `authLimiter` at 20 req/15min will block test runs. Need to either reset or bypass in test env.

## Requirements

### Functional
- Jest runs via `npm test`
- Auth routes tested: POST /auth/register, POST /auth/login, GET /auth/me, POST /auth/logout
- Tests cover: success cases, validation errors, duplicate user, wrong password, unauthorized access

### Non-Functional
- Tests must not hit production DB — use `TEST_DATABASE_URL` pointing to separate test DB
- Test DB must be seeded with schema before tests run
- Test files < 200 LOC each

## Architecture

### Test Strategy
<!-- Updated: Validation Session 1 - real test DB instead of mocked pool -->
- Use `supertest` to make HTTP requests against the Express app
- Use a **separate PostgreSQL test DB** via `TEST_DATABASE_URL` env var for highest fidelity
- Test DB must have schema applied before tests run (jest globalSetup or beforeAll migration)
- Set `NODE_ENV=test` to disable rate limiters

### App Export Refactor
```
// Bottom of server.js — replace app.listen() block
if (require.main === module) {
    app.listen(PORT, () => { ... });
}
module.exports = { app, pool };
```

## Related Code Files

### Modify
- `server.js` — extract `app` export (conditional listen)
- `package.json` — add jest, supertest devDeps + test script

### Create
- `jest.config.js` — Jest configuration
- `tests/setup.js` — global test setup (mock pool, disable rate limiters)
- `tests/auth.test.js` — auth route tests

## Implementation Steps

1. Install devDependencies:
   ```bash
   npm install --save-dev jest supertest
   ```

2. Add to `package.json` scripts:
   ```json
   "test": "jest --forceExit --detectOpenHandles"
   ```

3. Create `jest.config.js`:
   ```js
   module.exports = {
       testEnvironment: 'node',
       setupFilesAfterSetup: ['./tests/setup.js'],
       testMatch: ['**/tests/**/*.test.js'],
       coveragePathIgnorePatterns: ['/node_modules/', '/public/'],
   };
   ```

4. Refactor `server.js` bottom — wrap `app.listen()` in `require.main === module` guard. Export `{ app, pool }`.

5. Create `tests/setup.js`:
   - Set `NODE_ENV=test` before app loads (disables rate limiter)
   - Connect to test DB via `TEST_DATABASE_URL` env var
   - `beforeAll`: apply schema.sql to test DB (psql or pg client)
   - `afterAll`: drop test tables or truncate for isolation
   - Add `TEST_DATABASE_URL` to `.env.example` (Phase 03 will document it)

6. Create `tests/auth.test.js` with test groups:
   - **POST /auth/register**: valid registration returns 201; missing fields returns 400; duplicate username returns 400; short password returns 400
   - **POST /auth/login**: valid login returns 200 + user object; wrong password returns 401; missing fields returns 400
   - **GET /auth/me**: with valid session returns user; without session returns 401
   - **POST /auth/logout**: destroys session returns success

7. Run `npm test` and verify all pass.

## Todo List

- [ ] Install jest + supertest
- [ ] Add test script to package.json
- [ ] Create jest.config.js
- [ ] Refactor server.js to export app (conditional listen)
- [ ] Create tests/setup.js with pool mock
- [ ] Write tests/auth.test.js (8+ test cases)
- [ ] Verify `npm test` passes

## Success Criteria
- `npm test` exits 0
- Auth route tests cover: register (4 cases), login (3 cases), me (2 cases), logout (1 case) = 10+ assertions
- server.js still starts normally via `npm start`

## Risk Assessment
| Risk | Mitigation |
|------|------------|
| app.listen refactor breaks production start | Guard with `require.main === module`; verify `npm start` still works |
| bcrypt.hash slow in tests | Use low salt rounds in test env or mock bcrypt |
| Rate limiter blocks rapid test requests | Reset limiter between tests or disable when NODE_ENV=test |

## File Ownership
```
server.js (bottom 15 lines only — export refactor)
package.json (devDeps + scripts.test)
jest.config.js (new)
tests/setup.js (new)
tests/auth.test.js (new)
```

## Next Steps
- Phase 02 depends on the same Jest config + app export
- Phase 08 extends test coverage to blog/admin/export routes
