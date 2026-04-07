# Cattle Action / Con Bò Cười

**Precision Livestock Farming Platform with Real-time Behavior Monitoring & AI Detection**

---

## Overview

Cattle Action (Con Bò Cười) is an integrated platform that combines Computer Vision, AI, and Web technologies to monitor cattle behavior in real-time. The system detects cattle, classifies behaviors (standing, lying, eating, drinking, walking, abnormal), and alerts farm staff to early signs of health or safety issues. Designed for scale: single-farm today, multi-tenant SaaS tomorrow.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | HTML5, CSS3, Vanilla JavaScript (ES6) |
| **Backend** | Node.js 16+, Express.js |
| **Database** | PostgreSQL 14+ (on VPS) |
| **AI Service** | Python, FastAPI, YOLOv8 (Ultralytics) |
| **Model Backend** | PyTorch (.pt) or ONNX Runtime |
| **Image Processing** | OpenCV |
| **File Upload** | Multer (multipart/form-data) |
| **Session Storage** | PostgreSQL (connect-pg-simple) |
| **Deployment** | PM2, Nginx (reverse proxy), GitHub Actions |

## Quick Start

### Prerequisites
- Node.js 16+ and npm/yarn
- PostgreSQL 12+ (local or VPS)
- Git

### Setup (Local Development)

```bash
# 1. Clone repository
git clone <repo-url>
cd Cow-Visioning

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env
# Edit .env with your database credentials

# 4. Initialize database
psql -U <db-user> -d cow_visioning -f schema.sql

# 5. Start server
npm start
# Server runs on http://localhost:3000
```

### Connect to Remote PostgreSQL (VPS)

If using a VPS database (e.g., 180.93.2.32:5432):

```env
DB_HOST=180.93.2.32
DB_PORT=5432
DB_NAME=cow_visioning
DB_USER=cowapp
DB_PASSWORD=<your_secure_password>
CONNECTION_TIMEOUT_MS=10000
```

Verify connectivity:
```powershell
# Windows
Test-NetConnection 180.93.2.32 -Port 5432

# Linux/Mac
telnet 180.93.2.32 5432
```

## Project Structure

```
Cow-Visioning/
├── server.js                   # Express backend (~1500 lines)
├── package.json                # Dependencies
├── .env.example                # Environment template
├── schema.sql                  # Database DDL (8 tables)
├── ecosystem.config.js         # PM2 configuration
├── nginx-cow-visioning.conf    # Nginx reverse proxy config
│
├── public/                     # Frontend (SPA)
│   ├── index.html              # Main entry point (tab-based)
│   ├── auth/                   # Auth pages (login, register)
│   ├── css/                    # Styling (Forest Green design)
│   ├── js/                     # Frontend modules
│   │   ├── api-config.js       # API base URL & behavior map
│   │   ├── auth.js             # Login/logout/session
│   │   ├── upload.js           # Image upload form
│   │   ├── camera.js           # Webcam capture + burst mode
│   │   ├── gallery.js          # Image gallery & search
│   │   ├── export.js           # CSV/JSON export
│   │   ├── blog.js             # Blog posts & comments
│   │   ├── admin.js            # Admin dashboard
│   │   └── session.js          # Session management
│   └── uploads/                # Image storage (dated folders)
│
├── ai_service/                 # Python FastAPI service
│   ├── main.py                 # FastAPI app (port 8001)
│   ├── requirements.txt         # Python dependencies
│   ├── models/                 # YOLO model storage
│   └── utils/                  # Detection & annotation logic
│
├── docs/                       # Documentation
│   ├── project-overview-pdr.md
│   ├── code-standards.md
│   ├── codebase-summary.md
│   ├── system-architecture.md
│   ├── project-roadmap.md
│   └── deployment-guide.md
│
├── .github/workflows/          # CI/CD
│   └── deploy.yml              # Auto-deploy on push to main
│
└── .claude/                    # Claude Code config
```

## Key Environment Variables

### Database
```
DB_HOST=localhost              # PostgreSQL host
DB_PORT=5432                   # PostgreSQL port
DB_NAME=cow_visioning          # Database name
DB_USER=cowapp                 # DB user
DB_PASSWORD=<secure>           # DB password
```

### Server
```
PORT=3000                      # Express server port
NODE_ENV=production            # development | production
SESSION_SECRET=<random>        # Session encryption key
```

### AI Service
```
AI_SERVICE_URL=http://127.0.0.1:8001    # FastAPI endpoint
AI_TIMEOUT_MS=20000                      # Request timeout
AI_ENABLED=true                          # Enable/disable AI
AI_DEVICE=cpu                            # cpu | cuda
AI_CONF_THRESHOLD=0.25                   # Confidence threshold
AI_IOU_THRESHOLD=0.45                    # IoU threshold
AI_MAX_DET=50                            # Max detections per image
AI_MODEL_NAME=cattle_behavior_v1         # Model identifier
AI_MODEL_BACKEND=pt                      # pt | onnx
```

### Upload & API
```
UPLOAD_DIR=./uploads                            # Local upload folder
IMAGE_BASE_URL=                                 # (empty = relative URLs)
PUBLIC_API_BASE_URL=https://pctsv.io.vn         # Public API endpoint
CORS_ALLOWED_ORIGINS=                           # (empty = allow all)
```

### Security
```
SESSION_COOKIE_SAMESITE=lax                     # lax | strict | none
SESSION_COOKIE_SECURE=false                     # true for HTTPS only
```

## Core Features

### 1. Authentication & Authorization
- User registration & login (bcryptjs hashing)
- Role-based access control: `user`, `admin`
- Server-side session management (7-day expiry)

### 2. Image Management
- Drag-drop or form-based upload
- Webcam capture with burst mode
- Automatic date-based folder structure (`/uploads/YYYY/MM/uuid.jpg`)

### 3. AI Detection Pipeline
- Image → YOLOv8 model → behavior classification
- 6 behavior classes: standing, lying, eating, drinking, walking, abnormal
- Bounding box annotation with confidence scores

### 4. Gallery & Search
- Browse uploaded images with filters
- Search by cow ID, behavior, barn area
- Delete images with file cleanup

### 5. Data Export
- CSV export with metadata
- JSON export for AI training datasets
- Bulk export by date range or behavior

### 6. Blog & Community
- Post creation/editing/deletion
- Comments and likes on posts
- Inline image attachments

### 7. Admin Dashboard
- User management
- AI configuration
- System statistics

---

## API Endpoints Summary

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| POST | /auth/register | none | User signup |
| POST | /auth/login | none | User login |
| POST | /auth/logout | user | Logout |
| GET | /auth/me | user | Current user info |
| GET | /auth/status | user | Session status |
| POST | /api/images | user | Upload image + metadata |
| GET | /api/images | user | List images (filterable) |
| PUT | /api/images/:id/label | user | Relabel image |
| DELETE | /api/images/:id | user | Delete image |
| POST | /api/blog/posts | user | Create post |
| GET | /api/blog/posts | user | List posts |
| PUT | /api/blog/posts/:id | admin | Edit post |
| DELETE | /api/blog/posts/:id | admin | Delete post |
| POST | /api/blog/posts/:id/comments | user | Add comment |
| POST | /api/blog/posts/:id/likes | user | Like post |
| GET | /admin/users | admin | List users |
| PUT | /admin/users/:id/role | admin | Change role |
| DELETE | /admin/users/:id | admin | Delete user |
| GET | /admin/ai-settings | admin | AI config |
| PUT | /admin/ai-settings | admin | Update AI config |
| GET | /api/version | none | App version |
| GET | /api/ai-settings | user | Public AI settings |

---

## Database Schema (8 Tables)

| Table | Purpose |
|-------|---------|
| `users` | User accounts (username, password, role) |
| `session` | Express session store (auto-managed) |
| `cow_images` | Image metadata (cow_id, behavior, path, etc.) |
| `blog_posts` | Blog articles |
| `blog_post_images` | Images attached to blog posts |
| `blog_comments` | Comments on blog posts |
| `blog_likes` | Likes on blog posts |
| `app_config` | System configuration (AI settings, etc.) |

---

## Documentation

- **[Project Overview & PDR](./docs/project-overview-pdr.md)** - Vision, goals, requirements, role hierarchy
- **[System Architecture](./docs/system-architecture.md)** - 4-layer architecture, data flow, diagrams
- **[Code Standards](./docs/code-standards.md)** - Naming conventions, file size limits, error handling
- **[Codebase Summary](./docs/codebase-summary.md)** - Module reference, API tables, database schema
- **[Deployment Guide](./docs/deployment-guide.md)** - VPS setup, PM2, Nginx, SSL, GitHub Actions
- **[Project Roadmap](./docs/project-roadmap.md)** - Phase 1 (current), Phase 2 (planned), Phase 3 (future)

---

## Deployment

### Local Development
```bash
npm run dev      # Nodemon auto-reload
npm start        # Production-like start
```

### VPS Deployment
See [Deployment Guide](./docs/deployment-guide.md) for full setup.

Quick summary:
```bash
# On VPS (as cowapp user)
git clone <repo> ~/myapp
cd ~/myapp
npm install --production
pm2 start ecosystem.config.js
sudo systemctl reload nginx
```

### GitHub Actions CI/CD
Push to `main` branch → Auto-deploy via GitHub Actions (see `.github/workflows/deploy.yml`)

---

## Troubleshooting

**Camera not working on HTTP?**
- Browsers block `getUserMedia()` on HTTP. Use HTTPS or localhost only. Deploy with SSL certificate.

**Database connection timeout?**
- Check firewall allows port 5432
- Verify VPS PostgreSQL `listen_addresses = '*'`
- Confirm `.env` credentials are correct

**AI Service returns 500?**
- Check AI service is running: `pm2 logs` or `curl http://127.0.0.1:8001/health`
- Verify model file exists at `AI_MODEL_PATH`
- Check `AI_TIMEOUT_MS` is high enough (min 10000ms for large images)

---

## License

[Check LICENSE file](./LICENSE)

---

## Support & Contact

For issues, feature requests, or questions, refer to documentation in `./docs` or create an issue on GitHub.

**Last Updated:** 2026-04-07  
**Maintained by:** Tran Tan Dat (WPCAmin)
