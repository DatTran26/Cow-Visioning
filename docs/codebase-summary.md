# Cattle Action: Codebase Summary

**Last Updated**: 2026-04-07  
**Version**: 1.0

---

## Project Overview

**Cattle Action** is a Node.js + Express web application for monitoring cattle behavior via AI-powered image analysis. It combines frontend image upload, backend API, PostgreSQL database, and Python FastAPI AI service to detect cattle behaviors and generate alerts.

---

## Directory Structure

```
Cow-Visioning/
├── server.js                      # Express backend (~1500 LOC)
├── package.json                   # Node.js dependencies
├── .env.example                   # Environment template
├── schema.sql                      # Database DDL (8 tables)
├── ecosystem.config.js            # PM2 config
├── nginx-cow-visioning.conf       # Nginx reverse proxy
├── public/                        # Frontend SPA
│   ├── index.html                 # Main HTML (tab-based UI)
│   ├── auth/                      # Auth pages
│   ├── css/                       # Styling
│   └── js/                        # Frontend modules (8 files)
├── ai_service/                    # Python FastAPI
│   ├── main.py                    # FastAPI app (port 8001)
│   ├── requirements.txt
│   └── utils/
├── docs/                          # Documentation (this folder)
├── .github/workflows/             # GitHub Actions CI/CD
└── .claude/                       # Claude Code config
```

---

## Backend Modules

| Module | Responsibility | Key Endpoints |
|--------|---|---|
| **Authentication** | User signup, login, logout, sessions | `/auth/register`, `/auth/login`, `/auth/logout` |
| **Images API** | Upload, list, label, delete images | `/api/images` (POST/GET/PUT/DELETE) |
| **Blog API** | Posts, comments, likes | `/api/blog/posts`, `/api/blog/posts/:id/comments` |
| **Admin API** | User management, AI config | `/admin/users`, `/admin/ai-settings` |
| **Public API** | Version, AI settings, runtime config | `/api/version`, `/api/ai-settings` |

---

## Database Schema (8 Tables)

| Table | Purpose | Key Columns |
|-------|---------|------------|
| `users` | User accounts | id, username, password_hash, role, created_at |
| `session` | Express sessions (auto-managed) | sid, sess, expire |
| `cow_images` | Image metadata | id, user_id, cow_id, behavior, image_url, created_at |
| `blog_posts` | Blog articles | id, user_id, title, content, created_at |
| `blog_post_images` | Blog images | id, post_id, image_url |
| `blog_comments` | Post comments | id, post_id, user_id, content, created_at |
| `blog_likes` | Post likes | id, post_id, user_id (unique pair) |
| `app_config` | System config | key, value, updated_at |

---

## API Endpoints (23 Total)

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | /auth/register | none | User signup |
| POST | /auth/login | none | User login |
| GET | /auth/me | user | Current user info |
| GET | /auth/status | user | Session status |
| POST | /auth/logout | user | Logout |
| POST | /api/images | user | Upload image |
| GET | /api/images | user | List images (filterable) |
| PUT | /api/images/:id/label | user | Relabel image |
| DELETE | /api/images/:id | user | Delete image |
| POST | /api/blog/posts | user | Create post |
| GET | /api/blog/posts | user | List posts |
| PUT | /api/blog/posts/:id | admin | Edit post |
| DELETE | /api/blog/posts/:id | admin | Delete post |
| POST | /api/blog/posts/:id/comments | user | Add comment |
| DELETE | /api/blog/comments/:id | user | Delete comment |
| POST | /api/blog/posts/:id/likes | user | Like post |
| DELETE | /api/blog/posts/:id/likes | user | Unlike post |
| GET | /admin/users | admin | List users |
| PUT | /admin/users/:id/role | admin | Change role |
| DELETE | /admin/users/:id | admin | Delete user |
| GET | /admin/ai-settings | admin | Get AI config |
| PUT | /admin/ai-settings | admin | Update AI config |
| GET | /admin/stats | admin | System stats |
| GET | /api/version | none | App version |
| GET | /api/ai-settings | user | Public AI settings |

---

## Frontend Modules (public/js/)

| File | Purpose |
|------|---------|
| `api-config.js` | API base URL, behavior map constants |
| `auth.js` | Login, logout, session check |
| `upload.js` | Image upload form, validation |
| `camera.js` | Webcam capture, burst mode |
| `gallery.js` | Gallery grid, search, filter, delete |
| `export.js` | CSV/JSON export |
| `blog.js` | Blog posts, comments, likes |
| `admin.js` | User management, AI config |
| `session.js` | Session state, auto-logout |

---

## Environment Variables (25 Total)

### Database (5)
`DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`

### Server (3)
`PORT`, `NODE_ENV`, `SESSION_SECRET`

### AI Service (9)
`AI_SERVICE_URL`, `AI_TIMEOUT_MS`, `AI_ENABLED`, `AI_DEVICE`, `AI_CONF_THRESHOLD`, `AI_IOU_THRESHOLD`, `AI_MAX_DET`, `AI_MODEL_NAME`, `AI_MODEL_BACKEND`

### Upload & API (5)
`UPLOAD_DIR`, `IMAGE_BASE_URL`, `PUBLIC_API_BASE_URL`, `CORS_ALLOWED_ORIGINS`, `AI_EMBED_IMAGE_PAYLOAD`

### Security (2)
`SESSION_COOKIE_SAMESITE`, `SESSION_COOKIE_SECURE`

---

## Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Backend** | Node.js 16+, Express 4.18+ | Web framework |
| **Database** | PostgreSQL 12+ | Data storage |
| **Sessions** | connect-pg-simple | Session store |
| **Auth** | bcryptjs 2.4+ | Password hashing |
| **Upload** | multer 1.4+ | File handling |
| **Frontend** | Vanilla JS (ES6+), CSS3 | UI (no frameworks) |
| **AI** | Python 3.8+, FastAPI | AI API |
| **Detection** | YOLOv8 (Ultralytics) | Object detection |
| **Annotation** | OpenCV 4.5+ | Image processing |
| **Process Mgr** | PM2 5.0+ | Node.js process manager |
| **Web Server** | Nginx | Reverse proxy |

---

## Behavior Classification (6 Classes)

1. **standing** - Cattle upright on four legs
2. **lying** - Cattle lying down (normal rest)
3. **eating** - Head down at feed trough
4. **drinking** - At water source
5. **walking** - Moving/walking
6. **abnormal** - Unusual behavior (injury, prolonged lying, etc.)

Default thresholds: confidence ≥0.25, IoU ≥0.45

---

## Upload Storage Structure

```
/uploads/
├── original/YYYY/MM/
│   └── {uuid}.jpg
└── blog/YYYY/MM/
    └── {uuid}.jpg
```

Each upload generates unique UUID to prevent collisions.

---

## Key Code Paths

### Image Upload Flow
1. Frontend form → Multer save → AI inference → Annotation → DB save → Gallery update

### Authentication Flow
1. Register: Hash password → DB save
2. Login: Verify hash → Create session → DB save
3. Protected routes: Check session via middleware

### Export Flow
1. Gallery filter params → DB query → Generate CSV/JSON → Download

---

## Performance

| Operation | Typical | Target |
|-----------|---------|--------|
| Upload → AI result | 15-20s | <20s |
| Gallery load (100 images) | 1-2s | <2s |
| Search (10k images) | 0.5-2s | <2s |
| Export (1000 rows) | 3-5s | <5s |
| API response | 100-500ms | <500ms |

---

## Known Limitations (Phase 1)

- No multi-tenant enforcement (structure exists, not enforced)
- No real-time alerts (infrastructure ready)
- No visual re-identification (each image independent)
- Synchronous image processing (no async queue)
- Single database instance (no failover)
- Manual model retraining (no automation)

---

## Future Enhancements (Phase 2+)

- Enforce farm_id in all queries (multi-tenant)
- Implement 5-role RBAC
- Real-time alert system
- Async image job queue
- Audit logging
- Database failover

---

**Last Updated**: 2026-04-07  
**Version**: 1.0
