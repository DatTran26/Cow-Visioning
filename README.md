# Cow-Visioning 🐄

A web application for managing cow image datasets for AI training. Capture, upload, organize, and export images with metadata (cow ID, behavior, barn area) for livestock vision models.

## ✨ Features

### Core Features
- **About Page**: Project introduction with animated hero, feature overview, statistics, and behavior classification
- **Upload Images**: Drag-drop or form-based upload with metadata and AI analysis
- **Camera Integration**: Real-time webcam capture with Burst Mode (continuous shooting)
- **Image Gallery**: Browse, search, filter, and delete images with AI annotations
- **Export Dataset**: Export as CSV or JSON for AI training
- **Blog / Community**: Create posts, comment, like, attach images
- **Version Notification**: Auto-detect new deployment and prompt users to refresh

### AI Features
- **YOLO Object Detection**: Automatic cow detection with bounding boxes
- **Behavior Classification**: AI-predicted behavior labels (standing, lying, eating, drinking, walking, abnormal)
- **Confidence Scoring**: Per-detection confidence percentage
- **Annotated Images**: Auto-generated images with bounding box overlays

### Security & Auth
- **User Authentication**: Register/login with session management
- **Password Hashing**: bcryptjs with cost factor 10
- **Rate Limiting**: Per-endpoint rate limits on all write operations
- **Session Storage**: PostgreSQL-backed sessions (7-day TTL)

### DevOps
- **Auto-Deploy**: GitHub Actions → VPS with SSH deployment
- **Auto-Migrate**: Database schema runs on each deploy (safe with `IF NOT EXISTS`)
- **PM2 Process Manager**: Auto-restart, log management
- **Nginx Reverse Proxy**: SSL/HTTPS with Let's Encrypt
- **Responsive UI**: Works on desktop and mobile

## 🏗️ Architecture

```
┌──────────────────┐
│   Web Browser    │
│  (HTML/CSS/JS)   │
└────────┬─────────┘
         │ HTTPS
         ▼
┌──────────────────┐
│  Nginx Reverse   │
│      Proxy       │
│    (:80/:443)    │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐     ┌──────────────────┐
│   Express.js     │────▶│  AI Service      │
│   API Server     │     │  (FastAPI/YOLO)  │
│   (:3000)        │     │  (:8001)         │
└────────┬─────────┘     └──────────────────┘
         │
    ┌────┴──────┐
    ▼           ▼
┌────────┐  ┌──────────────┐
│uploads/│  │ PostgreSQL   │
│ YYYY/MM│  │ (cow_images, │
└────────┘  │  users, blog)│
            └──────────────┘
```

**Stack:**
| Component | Technology |
|-----------|------------|
| Frontend | HTML/CSS/JavaScript (vanilla) |
| Backend | Node.js + Express |
| AI Service | Python + FastAPI + selectable `.pt` / `.onnx` inference backends |
| Database | PostgreSQL |
| File Upload | Multer (local storage) |
| Web Server | Nginx (reverse proxy + SSL) |
| Process Manager | PM2 |
| Deployment | GitHub Actions → VPS Ubuntu |

## 🚀 Quick Start

### Local Development

**Prerequisites:**
- Node.js 16+
- PostgreSQL 12+
- Python 3.8+ (optional, for AI service)

**Setup:**
```bash
# Clone and install
git clone https://github.com/DatTran26/Cow-Visioning.git
cd Cow-Visioning
npm install

# Setup database
createdb cow_visioning
psql -d cow_visioning -f schema.sql

# Configure environment
cp .env.example .env
nano .env  # Edit DB credentials

# Run server
npm start
# Visit http://localhost:3000
```

**AI Service (optional):**
```bash
pip install -r ai_service/requirements.txt
npm run start:ai
# AI runs at http://127.0.0.1:8001
```

### VPS Deployment

**👉 For VPS beginners:** Start with [VPS_QUICKSTART.md](./VPS_QUICKSTART.md)

For comprehensive documentation, see [DEPLOYMENT.md](./DEPLOYMENT.md)

## 📁 Project Structure

```
cow-visioning/
├── public/                    # Frontend (served by Express)
│   ├── index.html            # Main app (all tabs)
│   ├── css/
│   │   ├── main.css          # Primary styles
│   │   ├── auth.css          # Login/register styles
│   │   └── style.css         # Additional styles
│   ├── js/
│   │   ├── api-config.js     # Config & behavior map
│   │   ├── upload.js         # Upload form + drag-drop
│   │   ├── camera.js         # Camera + Burst Mode
│   │   ├── gallery.js        # Gallery + search + delete
│   │   ├── export.js         # CSV/JSON export
│   │   └── blog.js           # Blog posts, comments, likes
│   └── images/               # Static images
│
├── ai_service/               # Python AI service
│   ├── app.py               # FastAPI server
│   ├── models/              # YOLO model weights (.pt/.onnx)
│   ├── behavior_map.json    # Class → behavior mapping
│   └── requirements.txt     # Python dependencies
│
├── server.js                 # Express server (REST API)
├── schema.sql                # PostgreSQL DDL + migrations
├── package.json              # Node.js dependencies
├── .env.example              # Config template
│
├── ecosystem.config.js       # PM2 config
├── nginx-cow-visioning.conf  # Nginx config
├── .github/workflows/
│   └── deploy.yml            # GitHub Actions CI/CD
│
├── DEPLOYMENT.md             # Deployment guide
├── VPS_QUICKSTART.md         # Beginner VPS setup
└── README.md                 # This file
```

## 🔌 API Endpoints (22 routes)

### Authentication
| Method | Endpoint | Description | Rate Limit |
|--------|----------|-------------|------------|
| GET | `/auth/login` | Login page | - |
| GET | `/auth/register` | Register page | - |
| POST | `/auth/register` | Create account | 20/15min |
| POST | `/auth/login` | Authenticate | 20/15min |
| GET | `/auth/me` | Current user info | - |
| POST | `/auth/logout` | Logout | - |

### Images / Dataset
| Method | Endpoint | Description | Rate Limit |
|--------|----------|-------------|------------|
| POST | `/api/images` | Upload image + metadata + AI | 50/15min |
| GET | `/api/images` | List/filter images | - |
| DELETE | `/api/images/:id` | Delete image + file | - |
| GET | `/api/version` | App version (git hash) | - |

### Blog
| Method | Endpoint | Description | Rate Limit |
|--------|----------|-------------|------------|
| GET | `/api/blog/posts` | List all posts | - |
| POST | `/api/blog/posts` | Create post | 50/15min |
| PUT | `/api/blog/posts/:id` | Edit post (author only) | 50/15min |
| DELETE | `/api/blog/posts/:id` | Delete post (author only) | 50/15min |
| POST | `/api/blog/posts/:postId/images` | Attach image | 50/15min |
| DELETE | `/api/blog/images/:id` | Remove image | 50/15min |
| GET | `/api/blog/posts/:postId/comments` | List comments | - |
| POST | `/api/blog/posts/:postId/comments` | Add comment | 40/10min |
| DELETE | `/api/blog/comments/:id` | Delete comment | 40/10min |
| POST | `/api/blog/posts/:postId/likes` | Toggle like | 120/5min |

## 🐄 Behavior Types

| Value | Vietnamese | Description |
|-------|-----------|-------------|
| `standing` | Đứng | Cow is standing |
| `lying` | Nằm | Cow is lying down |
| `eating` | Ăn | Cow is eating |
| `drinking` | Uống nước | Cow is drinking water |
| `walking` | Đi lại | Cow is walking |
| `abnormal` | Bất thường | Unusual/abnormal behavior |

## 💾 Database Schema

### Tables
| Table | Purpose |
|-------|---------|
| `cow_images` | Image metadata, AI results, bounding boxes |
| `users` | User accounts (username, email, password hash, role) |
| `blog_posts` | Blog posts (title, content, timestamps) |
| `blog_comments` | Comments on posts |
| `blog_likes` | Like/unlike (unique per user per post) |
| `blog_post_images` | Images attached to blog posts |
| `app_config` | App configuration (TOTP secrets, etc.) |
| `session` | Express session storage (connect-pg-simple) |

## 📸 Camera Features

**Single Shot:** Click capture button → saves 1 image immediately

**Burst Mode:** Long press/hold capture button → continuous shots (~1 per 500ms). Release to stop.

**Auto-save:** Toggle on → images upload automatically without manual form submission

## 🤖 AI Integration

When `AI_ENABLED=true`, uploaded images are sent to the YOLO AI service for detection:

1. User uploads image → saved to disk
2. Server sends image path to AI service (`POST /predict`)
3. YOLO model (`.pt` or `.onnx`) runs inference → detects cows, classifies behavior
4. Annotated image with bounding boxes saved
5. Results stored in DB: confidence, detection count, bbox coordinates

**Configuration (.env):**
```env
AI_ENABLED=true
AI_SERVICE_URL=http://127.0.0.1:8001
AI_TIMEOUT_MS=20000
AI_MODEL_BACKEND=auto
AI_MODEL_PATH=./ai_service/models/boudding_catllte_v1_22es.pt  # or .onnx
# AI_CLASS_NAMES_PATH=./ai_service/class_names.json  # Optional for ONNX without embedded metadata
AI_DEVICE=cpu
AI_CONF_THRESHOLD=0.25
```

## 🔧 Environment Variables

```env
# Server
PORT=3000

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=cow_visioning
DB_USER=cowapp
DB_PASSWORD=your_secure_password

# Storage
UPLOAD_DIR=./uploads

# Auth
SESSION_SECRET=your_random_64_char_secret_here
PUBLIC_API_BASE_URL=
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
SESSION_COOKIE_SAMESITE=none
SESSION_COOKIE_SECURE=true
TOTP_APP_NAME=Cow-Visioning

# AI Service (optional)
AI_ENABLED=true
AI_SERVICE_URL=http://127.0.0.1:8001
AI_TIMEOUT_MS=20000
AI_MODEL_BACKEND=auto
AI_MODEL_PATH=./ai_service/models/boudding_catllte_v1_22es.pt  # or .onnx
# AI_CLASS_NAMES_PATH=./ai_service/class_names.json  # Optional for ONNX without embedded metadata
AI_DEVICE=cpu
AI_CONF_THRESHOLD=0.25
AI_IOU_THRESHOLD=0.45
AI_MAX_DET=50
```

If you want a local frontend to always send uploads to the VPS API, set:

```env
PUBLIC_API_BASE_URL=https://your-vps-domain
```

on the frontend server, and allow that frontend origin on the VPS:

```env
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
SESSION_COOKIE_SAMESITE=none
SESSION_COOKIE_SECURE=true
```

## 🚢 Deployment

### Automated (GitHub Actions)

1. **Setup VPS:** Follow [DEPLOYMENT.md](./DEPLOYMENT.md)
2. **Add GitHub Secrets:** `DEPLOY_KEY`, `VPS_HOST`, `VPS_USER`
3. **Deploy:** `git push origin main` → auto-deploys to VPS
4. **Monitor:** Check Actions tab or `pm2 logs cow-visioning`

### CI/CD Pipeline
```
git push main → GitHub Actions → SSH to VPS → git pull → npm install
             → psql -f schema.sql (auto-migrate) → pm2 restart
```

## 📋 Common Commands

**Server:**
```bash
pm2 restart cow-visioning      # Restart
pm2 logs cow-visioning         # View logs
pm2 status                     # All processes
```

**Database:**
```bash
pg_dump -U cowapp cow_visioning | gzip > backup.sql.gz    # Backup
gunzip < backup.sql.gz | psql -U cowapp cow_visioning     # Restore
psql -U cowapp -d cow_visioning -f schema.sql             # Migrate
```

**Nginx:**
```bash
sudo nginx -t                  # Test config
sudo systemctl reload nginx    # Reload
```

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| Port 3000 in use | `lsof -i :3000` then `kill -9 <PID>` |
| PostgreSQL error | Check `.env` credentials, `systemctl status postgresql` |
| Nginx 502 | Check `pm2 logs`, verify Express is running |
| Permission denied (uploads) | `chown -R cowapp:cowapp uploads/` |
| CI/CD SSH error | Verify `DEPLOY_KEY` secret, check `~/.ssh/authorized_keys` |
| AI service error | Check `AI_ENABLED`, verify model file exists |

## 📚 Documentation

- **[DEPLOYMENT.md](./DEPLOYMENT.md)** - Complete VPS deployment guide
- **[VPS_QUICKSTART.md](./VPS_QUICKSTART.md)** - Step-by-step beginner guide

## 📄 License



## 👥 Author

DatTran26

---

**Last Updated:** 2026-03-23
**Version:** 1.0.0 (Self-hosted with auto-deploy + AI)
