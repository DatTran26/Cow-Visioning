# Phase 09 — Split upload.js, session.js, app.js

## Context Links
- `public/js/upload.js` — 218 LOC, IIFE module `Upload`
- `public/js/session.js` — 206 LOC, IIFE module `AppSession`
- `public/js/app.js` — 208 LOC, DOMContentLoaded handler + helpers
- `public/index.html` — script loading order (after Phase 04/05/06 changes)

## Overview
- **Priority**: P3
- **Status**: Completed
- **Group**: D (after Groups B+C complete)
- **Description**: Split the 3 remaining over-200-LOC frontend files into focused modules

## Key Insights

### upload.js (218 LOC)
- Functions: `init`, `addFiles`, `removeFile`, `renderPreviews`, `handleUpload`, `renderAiResult`, `buildAiSummary`, `buildAiMeta`, `formatConfidence`, `showStatus`
- AI display functions (`renderAiResult`, `buildAiSummary`, `buildAiMeta`, `formatConfidence`) are **duplicated** with camera.js — DRY opportunity
- Split: extract AI display helpers to shared module; upload core stays under 200 LOC

### session.js (206 LOC)
- Functions: `sanitizeNext`, `currentPath`, `getLoginUrl`, `getRegisterUrl`, `setVisibility`, `markSessionReady`, `dispatchChange`, `applyAuthUi`, `fetchCurrentUser`, `refresh`, `wrapFetch`, `requireAuth`, `init`
- `applyAuthUi` alone is ~65 LOC (lines 52-117) — the bulk
- Split: extract `applyAuthUi` into `session-ui.js`; core session logic stays in `session.js`

### app.js (208 LOC)
- Functions: DOMContentLoaded handler (tab routing, module init, logout), `initSidebarLiveInfo` (~60 LOC), `initVersionChecker` (~25 LOC), `showUpdatePopup` (~20 LOC)
- Split: extract `initSidebarLiveInfo` + `initVersionChecker` + `showUpdatePopup` into `app-helpers.js`

### DRY: Shared AI Display
`buildAiSummary`, `buildAiMeta`, `formatConfidence`, `BEHAVIOR_MAP` are duplicated across upload.js and camera.js (created in Phase 05 as `camera-ai-display.js`). Consolidate into one shared `ai-display-helpers.js` that both upload and camera reference.

## Requirements

### Functional
- All upload, session, and app functionality preserved
- Global APIs unchanged: `Upload.init()`, `AppSession.*`, tab routing
- Shared AI display helpers used by both upload and camera modules

### Non-Functional
- Every file < 200 LOC
- No code duplication for AI display functions
- IIFE pattern preserved

## Architecture

### Split Plan

**upload.js (218 LOC) -> 2 files:**
- `ai-display-helpers.js` (~50 LOC): `BEHAVIOR_MAP`, `renderAiResult` (generic), `buildAiSummary`, `buildAiMeta`, `formatConfidence` — shared between upload + camera
- `upload.js` (~160 LOC): everything else, references `window.AiDisplay.*`

**session.js (206 LOC) -> 2 files:**
- `session-ui.js` (~80 LOC): `applyAuthUi`, `setVisibility`, `markSessionReady` — DOM manipulation
- `session.js` (~130 LOC): auth logic, fetch wrapper, core API

**app.js (208 LOC) -> 2 files:**
- `app-helpers.js` (~90 LOC): `initSidebarLiveInfo`, `initVersionChecker`, `showUpdatePopup`
- `app.js` (~120 LOC): DOMContentLoaded, tab routing, module init

### Module Communication
```
ai-display-helpers.js -> window.AiDisplay = { BEHAVIOR_MAP, buildAiSummary, buildAiMeta, formatConfidence }
session-ui.js         -> window.SessionUI = { applyAuthUi, setVisibility, markSessionReady }
app-helpers.js        -> window.AppHelpers = { initSidebarLiveInfo, initVersionChecker, showUpdatePopup }
```

### Camera Integration
After creating `ai-display-helpers.js`, update `camera-ai-display.js` (from Phase 05) to delegate to `AiDisplay.*` or merge them. Decision: **merge** — rename `camera-ai-display.js` to `ai-display-helpers.js` and have both camera-capture.js and upload.js reference it.

## Related Code Files

### Modify
- `public/js/upload.js` — remove AI display functions, reference AiDisplay.*
- `public/js/session.js` — extract applyAuthUi to session-ui.js
- `public/js/app.js` — extract sidebar/version helpers
- `public/js/camera-capture.js` (from Phase 05) — update to use AiDisplay.* instead of CameraAI.*
- `public/js/camera-ai-display.js` (from Phase 05) — DELETE (merged into ai-display-helpers.js)
- `public/index.html` — update script tags

### Create
- `public/js/ai-display-helpers.js` — shared AI result display
- `public/js/session-ui.js` — session DOM manipulation
- `public/js/app-helpers.js` — sidebar, version checker

### Delete
- `public/js/camera-ai-display.js` — merged into ai-display-helpers.js

## Implementation Steps

1. **Create `public/js/ai-display-helpers.js`** (~50 LOC):
   - Merge content from camera-ai-display.js (Phase 05) + upload.js AI functions
   - Single source of truth for: `BEHAVIOR_MAP`, `buildAiSummary`, `buildAiMeta`, `formatConfidence`
   - NOTE: `renderAiResult` differs between upload and camera (different DOM elements) — keep those in their respective modules, only extract the pure helpers
   - Expose as `window.AiDisplay`

2. **Update `public/js/upload.js`** (down to ~160 LOC):
   - Remove: `buildAiSummary`, `buildAiMeta`, `formatConfidence`, `BEHAVIOR_MAP`
   - Replace with: `AiDisplay.buildAiSummary(record)`, etc.
   - Keep: `renderAiResult` (upload-specific DOM), `showStatus`, upload logic

3. **Update camera-capture.js** (from Phase 05):
   - Replace `CameraAI.buildAiSummary` -> `AiDisplay.buildAiSummary`
   - Replace `CameraAI.formatConfidence` -> `AiDisplay.formatConfidence`

4. **Delete `public/js/camera-ai-display.js`** (if Phase 05 created it; content now in ai-display-helpers.js)
   - If Phase 05 hasn't run yet, just plan for ai-display-helpers.js to contain all AI display code

5. **Create `public/js/session-ui.js`** (~80 LOC):
   - Extract: `applyAuthUi`, `setVisibility`, `markSessionReady`
   - Receives `currentUser` via `AppSession.getCurrentUser()` call
   - Expose as `window.SessionUI`

6. **Update `public/js/session.js`** (down to ~130 LOC):
   - Remove extracted functions
   - In `refresh()`: call `SessionUI.applyAuthUi()` instead of local `applyAuthUi()`
   - Keep: `fetchCurrentUser`, `wrapFetch`, `requireAuth`, `init`, `sanitizeNext`, auth state

7. **Create `public/js/app-helpers.js`** (~90 LOC):
   - Extract: `initSidebarLiveInfo`, `initVersionChecker`, `showUpdatePopup`
   - Expose as `window.AppHelpers`

8. **Update `public/js/app.js`** (down to ~120 LOC):
   - Replace: `initSidebarLiveInfo()` -> `AppHelpers.initSidebarLiveInfo()`
   - Replace: `initVersionChecker()` -> `AppHelpers.initVersionChecker()`
   - Keep: DOMContentLoaded handler, tab routing, module init calls

9. **Update `public/index.html`** script tags — final order:
   ```html
   <!-- Shared utilities -->
   <script src="js/api-config.js"></script>
   <script src="js/ai-display-helpers.js"></script>

   <!-- Session -->
   <script src="js/session-ui.js"></script>
   <script src="js/session.js"></script>

   <!-- Blog -->
   <script src="js/blog-utils.js"></script>
   <script src="js/blog-comments.js"></script>
   <script src="js/blog-posts.js"></script>

   <!-- Camera -->
   <script src="js/camera-capture.js"></script>
   <script src="js/camera-init.js"></script>

   <!-- Other modules -->
   <script src="js/upload.js"></script>
   <script src="js/gallery.js"></script>
   <script src="js/export.js"></script>
   <script src="js/settings.js"></script>
   <script src="js/admin-users.js"></script>
   <script src="js/admin-panel.js"></script>
   <script src="js/app-helpers.js"></script>
   <script src="js/app.js"></script>
   ```

10. **Full browser smoke test**: all tabs, auth flow, camera, upload, gallery, blog, admin

## Todo List

- [ ] Create public/js/ai-display-helpers.js (shared AI display)
- [ ] Update public/js/upload.js to use AiDisplay.*
- [ ] Update camera-capture.js to use AiDisplay.*
- [ ] Remove/merge camera-ai-display.js
- [ ] Create public/js/session-ui.js
- [ ] Update public/js/session.js to use SessionUI.*
- [ ] Create public/js/app-helpers.js
- [ ] Update public/js/app.js to use AppHelpers.*
- [ ] Update public/index.html with final script order
- [ ] Verify ALL js files < 200 LOC
- [ ] Full browser smoke test (every tab + auth)

## Success Criteria
- `upload.js` < 170 LOC
- `session.js` < 140 LOC
- `app.js` < 130 LOC
- All new files < 100 LOC
- Zero duplicated AI display functions across codebase
- All tabs functional in browser

## Risk Assessment
| Risk | Mitigation |
|------|------------|
| Script load order breaks with many new files | Document exact order; test incrementally |
| SessionUI.applyAuthUi needs closure vars from session.js | Pass currentUser via AppSession.getCurrentUser() |
| camera-ai-display.js merge conflicts with Phase 05 | Phase 09 runs after Phase 05; read Phase 05 output before merging |

## File Ownership
```
public/js/ai-display-helpers.js (CREATE)
public/js/session-ui.js (CREATE)
public/js/app-helpers.js (CREATE)
public/js/upload.js (MODIFY — remove AI helpers)
public/js/session.js (MODIFY — extract UI)
public/js/app.js (MODIFY — extract helpers)
public/js/camera-capture.js (MODIFY — update AiDisplay refs)
public/js/camera-ai-display.js (DELETE — merged)
public/index.html (final script tag order)
```

## Next Steps
- After this phase, run `wc -l public/js/*.js` to confirm all files < 200 LOC
- Run full test suite to verify no regressions
