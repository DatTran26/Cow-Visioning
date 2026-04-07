# Phase 05 — Split camera.js (470 LOC)

## Context Links
- `public/js/camera.js` — 470 LOC, IIFE module `Camera` with webcam, burst capture, AI result display
- `public/index.html` — script loading order

## Overview
- **Priority**: P2
- **Status**: Completed
- **Group**: B (after Group A; parallel with Phase 04, 06)
- **Description**: Split camera.js into 3 focused modules under 200 LOC each

## Key Insights
- `Camera` is an IIFE returning `{ init, startCamera, stopCamera }`
- Internal functions cluster into 3 domains:
  1. **Camera lifecycle** (~100 LOC): init, startCamera, stopCamera, toggleCamera, toggleSettings, hideSettings, updateSettingsUI, updateAutoSaveUI, mapCameraError
  2. **Capture & save** (~160 LOC): captureAndSave, startBurstOrSingle, stopBurst, dataURLToBlob, updateSavedUI
  3. **AI result display** (~60 LOC): renderAiResult, buildAiSummary, buildAiMeta, formatConfidence, BEHAVIOR_MAP
- Shared state: `stream`, `isOn`, `isCapturing`, `savedCount`, `savedThumbs`, `burstInterval`, `burstActive`, `autoSaveEnabled`, `settingsVisible`

### Split Strategy
1. **camera-ai-display.js** (~60 LOC): AI result rendering + BEHAVIOR_MAP constant + formatConfidence
2. **camera-capture.js** (~160 LOC): capture, burst, blob conversion, saved thumbnails UI
3. **camera-init.js** (~150 LOC): init, camera start/stop, settings panel, main Camera IIFE

## Requirements

### Functional
- Camera toggle, burst capture, auto-save, AI result display all work
- `Camera.init()`, `Camera.startCamera()`, `Camera.stopCamera()` exposed globally
- Burst capture (pointerdown/pointerup) still works on mobile + desktop

### Non-Functional
- Each file < 200 LOC
- IIFE pattern preserved; shared state managed via one module

## Architecture

### Module Communication
```
camera-ai-display.js -> window.CameraAI = { renderAiResult, buildAiSummary, buildAiMeta, formatConfidence, BEHAVIOR_MAP }
camera-capture.js    -> window.CameraCapture = { captureAndSave, startBurstOrSingle, stopBurst, updateSavedUI }
camera-init.js       -> window.Camera = { init, startCamera, stopCamera }
                        (orchestrates CameraCapture + CameraAI, owns shared state)
```

### Shared State Strategy
`camera-init.js` owns all shared state variables and passes them via a state object or getter functions:
```js
const state = { stream, isOn, isCapturing, savedCount, savedThumbs, burstInterval, burstActive, autoSaveEnabled, settingsVisible };
window._cameraState = state; // internal, not public API
```
`camera-capture.js` reads/writes `window._cameraState` for `isCapturing`, `savedCount`, etc.

Alternative (cleaner): camera-init.js passes state + setters to CameraCapture at init time.

## Related Code Files

### Delete
- `public/js/camera.js` — replaced by split files

### Create
- `public/js/camera-ai-display.js` — AI result rendering
- `public/js/camera-capture.js` — capture + burst logic
- `public/js/camera-init.js` — camera lifecycle + init (main module)

<!-- Updated: Validation Session 1 - index.html owned by Phase 09 -->

## Implementation Steps

1. **Create `public/js/camera-ai-display.js`** (~60 LOC):
   - Extract: `BEHAVIOR_MAP` constant (if exists in camera.js — check app.js/settings.js too; if shared, define here)
   - Extract: `renderAiResult`, `buildAiSummary`, `buildAiMeta`, `formatConfidence`
   - Expose as `window.CameraAI` IIFE

2. **Create `public/js/camera-capture.js`** (~160 LOC):
   - Extract: `captureAndSave`, `startBurstOrSingle`, `stopBurst`, `dataURLToBlob`, `updateSavedUI`
   - Accept state object reference from camera-init
   - Use `CameraAI.renderAiResult` and `CameraAI.buildAiSummary`
   - Expose as `window.CameraCapture` IIFE

3. **Create `public/js/camera-init.js`** (~150 LOC):
   - All state variables defined here
   - Camera start/stop/toggle, settings UI, auto-save toggle
   - Wire event listeners in init(), delegating capture events to CameraCapture
   - `generateAutoCowId()` stays here
   - Expose as `window.Camera = { init, startCamera, stopCamera }`

4. **Delete `public/js/camera.js`**
   *(index.html script tag updates handled by Phase 09)*

6. **Browser smoke test**: toggle camera, single capture, burst capture, AI result card

## Todo List

- [ ] Create public/js/camera-ai-display.js
- [ ] Create public/js/camera-capture.js
- [ ] Create public/js/camera-init.js
- [ ] Delete public/js/camera.js (index.html updated by Phase 09)
- [ ] Verify all 3 files < 200 LOC
- [ ] Browser smoke test: camera toggle, capture, burst, AI display

## Success Criteria
- `camera-ai-display.js` < 80 LOC
- `camera-capture.js` < 180 LOC
- `camera-init.js` < 170 LOC
- Camera tab fully functional (toggle, capture, burst, settings, AI result)
- `window.Camera.init/startCamera/stopCamera` still callable from app.js

## Risk Assessment
| Risk | Mitigation |
|------|------------|
| Shared mutable state across modules | Single state object in camera-init.js; other modules reference it |
| Burst timing broken by module boundary | startBurstOrSingle/stopBurst stay together in camera-capture.js |
| BEHAVIOR_MAP duplicated in upload.js | Extract to shared file or keep separate (DRY audit in Phase 09) |

## File Ownership
```
public/js/camera.js (DELETE)
public/js/camera-ai-display.js (CREATE)
public/js/camera-capture.js (CREATE)
public/js/camera-init.js (CREATE)
// public/index.html — owned by Phase 09, do not touch
```

## Next Steps
- Phase 09 may extract shared BEHAVIOR_MAP / AI display helpers if duplicated with upload.js
