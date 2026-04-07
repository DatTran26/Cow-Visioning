# Phase 06 — Split admin.js (228 LOC)

## Context Links
- `public/js/admin.js` — 228 LOC, IIFE module `Admin` with user management, AI settings, stats
- `public/index.html` — script loading order

## Overview
- **Priority**: P2
- **Status**: Completed
- **Group**: B (after Group A; parallel with Phase 04, 05)
- **Description**: Split admin.js into 2-3 focused modules under 200 LOC each

## Key Insights
- `Admin` IIFE returns `{ init, loadPanel }`
- Functions cluster into 3 domains:
  1. **Users** (~75 LOC): `loadUsers`, `changeRole`, `deleteUser` + table rendering
  2. **AI settings** (~75 LOC): `loadAiSettings`, `saveAiSettings` + slider/input binding
  3. **Stats + init** (~45 LOC): `loadStats`, `init`, `syncSessionState`, `loadPanel`
- At 228 LOC, this is barely over the limit. Splitting into 2 files (not 3) is sufficient:
  - **admin-users.js** (~90 LOC): user list + CRUD
  - **admin-panel.js** (~140 LOC): init, stats, AI settings, session sync

## Requirements

### Functional
- Admin panel loads users, AI settings, stats when admin navigates to tab
- `Admin.init()` and `Admin.loadPanel()` remain globally accessible
- Role changes and user deletion still work

### Non-Functional
- Each file < 200 LOC
- IIFE pattern preserved

## Architecture

### Module Communication
```
admin-users.js  -> window.AdminUsers = { loadUsers, changeRole, deleteUser }
admin-panel.js  -> window.Admin = { init, loadPanel }
                   (uses AdminUsers.loadUsers, AdminUsers.changeRole, etc.)
```

## Related Code Files

### Delete
- `public/js/admin.js` — replaced by split files

### Create
- `public/js/admin-users.js` — user management table
- `public/js/admin-panel.js` — init, stats, AI settings (main Admin module)

<!-- Updated: Validation Session 1 - index.html owned by Phase 09 -->

## Implementation Steps

1. **Create `public/js/admin-users.js`** (~90 LOC):
   - Extract: `loadUsers` (lines 66-127), `changeRole` (lines 129-142), `deleteUser` (lines 144-154)
   - `loadUsers` calls `loadStats` after delete — accept callback or use event
   - Expose as `window.AdminUsers = { loadUsers, changeRole, deleteUser }`

2. **Create `public/js/admin-panel.js`** (~140 LOC):
   - Remaining: `syncSessionState`, `init`, `loadPanel`, `loadStats`, `loadAiSettings`, `saveAiSettings`
   - `loadPanel` calls `AdminUsers.loadUsers()` + local `loadAiSettings()` + local `loadStats()`
   - `init` wires event listeners for AI sliders, save button
   - Expose as `window.Admin = { init, loadPanel }`

3. **Delete `public/js/admin.js`**
   *(index.html script tag updates handled by Phase 09)*

5. **Browser smoke test**: admin tab loads stats, user table, AI sliders

## Todo List

- [ ] Create public/js/admin-users.js
- [ ] Create public/js/admin-panel.js
- [ ] Delete public/js/admin.js (index.html updated by Phase 09)
- [ ] Verify both files < 200 LOC
- [ ] Browser smoke test: admin panel renders, user CRUD works, AI settings save

## Success Criteria
- `admin-users.js` < 100 LOC
- `admin-panel.js` < 150 LOC
- Admin tab fully functional
- `window.Admin.init()` and `window.Admin.loadPanel()` still work from app.js

## Risk Assessment
| Risk | Mitigation |
|------|------------|
| loadUsers references loadStats for refresh after delete | AdminUsers calls a callback or AdminPanel re-exports loadStats |
| Session state sync timing | syncSessionState runs in init before any panel load |

## File Ownership
```
public/js/admin.js (DELETE)
public/js/admin-users.js (CREATE)
public/js/admin-panel.js (CREATE)
// public/index.html — owned by Phase 09, do not touch
```

## Next Steps
- Phase 08 writes admin API tests against the server routes
