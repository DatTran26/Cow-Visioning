# Cow-Visioning 🐄

A web application for managing cow image datasets for AI training. Capture, upload, organize, and export images with metadata (cow ID, behavior, barn area) for livestock vision models.

## ✨ Features

- **About Page**: Project introduction with feature overview and behavior classification
- **Upload Images**: Drag-drop or form-based upload with metadata
- **Camera Integration**: Real-time webcam capture with Burst Mode (continuous shooting)
- **Image Gallery**: Browse, search, filter, and delete images
- **Export Dataset**: Export as CSV or JSON for AI training
- **Local Database**: PostgreSQL storage for metadata
- **Auto-Deploy**: GitHub Actions → VPS auto-deployment with auto database migration
- **Responsive UI**: Works on desktop and mobile

## 🏗️ Architecture

```
┌──────────────────┐
│   Web Browser    │
│  (HTML/CSS/JS)   │
└────────┬─────────┘
         │
         │ HTTP/HTTPS
         ▼
┌──────────────────┐
│  Nginx Reverse   │
│      Proxy       │
│    (:80/:443)    │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│   Express.js     │
│   API Server     │
│   (:3000)        │
├──────────────────┤
│ • POST /images   │ (Multer)
│ • GET /images    │ (Filter/Search)
│ • DELETE /images │
└────────┬─────────┘
         │
    ┌────┴──────┐
    ▼           ▼
┌────────┐  ┌──────────────┐
│uploads/│  │ PostgreSQL   │
│ YYYY/MM│  │ (cow_images) │
└────────┘  └──────────────┘
```

**Stack:**
| Component | Technology |
|-----------|------------|
| Frontend | HTML/CSS/JavaScript (vanilla) |
| Backend | Node.js + Express |
| Database | PostgreSQL |
| File Upload | Multer (local storage) |
| Web Server | Nginx (reverse proxy) |
| Process Manager | PM2 |
| Deployment | GitHub Actions → VPS Ubuntu |

## 🚀 Quick Start

### Local Development

**Prerequisites:**
- Node.js 16+
- PostgreSQL 12+
- npm or yarn

**Setup:**
```bash
# Clone and install
git clone <repo-url>
cd cow-visioning
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

### VPS Deployment

**👉 For VPS beginners:** Start with [VPS_QUICKSTART.md](./VPS_QUICKSTART.md) - detailed step-by-step guide from SSH to production.

For comprehensive documentation, see [DEPLOYMENT.md](./DEPLOYMENT.md) which includes:
- PostgreSQL setup on Ubuntu
- PM2 process management
- Nginx reverse proxy configuration
- SSL/Let's Encrypt setup
- GitHub Actions auto-deployment
- Production checklist

**Quick summary:**
```bash
# On VPS (Ubuntu):
ssh user@your_vps_ip
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs postgresql nginx
sudo npm install -g pm2

# Clone repo and follow DEPLOYMENT.md steps
```

## 📁 Project Structure

```
cow-visioning/
├── public/                    # Frontend (served by Express)
│   ├── index.html            # Main app
│   ├── css/
│   │   └── style.css         # Styling
│   ├── js/
│   │   ├── api-config.js     # Config constants
│   │   ├── app.js            # Tab navigation
│   │   ├── upload.js         # Upload form
│   │   ├── camera.js         # Camera + Burst Mode
│   │   ├── gallery.js        # Gallery + delete
│   │   └── export.js         # CSV/JSON export
│   └── uploads/              # Image files (YYYY/MM/uuid.jpg)
│
├── server.js                 # Express server (REST API)
├── schema.sql                # PostgreSQL DDL
├── package.json              # Dependencies
├── .env.example              # Config template
├── .env                      # Config (local, in .gitignore)
│
├── ecosystem.config.js       # PM2 process manager config
├── nginx-cow-visioning.conf  # Nginx reverse proxy config
├── .github/workflows/
│   └── deploy.yml            # GitHub Actions CI/CD
│
├── DEPLOYMENT.md             # Detailed deployment guide
├── VPS_QUICKSTART.md         # Step-by-step VPS setup guide
└── README.md                 # This file
```

## 🔌 API Endpoints

Base URL: `http://localhost:3000` (or your VPS domain)

### POST /api/images
**Upload image + metadata**

```bash
curl -X POST http://localhost:3000/api/images \
  -F "image=@photo.jpg" \
  -F "cow_id=BO-001" \
  -F "behavior=standing" \
  -F "barn_area=Chuồng A1" \
  -F "captured_at=2026-03-18T09:30:00Z" \
  -F "notes=Test image"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 5,
    "cow_id": "BO-001",
    "behavior": "standing",
    "image_url": "/uploads/2026/03/abc123.jpg",
    "created_at": "2026-03-18T09:35:22.000Z"
  }
}
```

### GET /api/images
**List/filter images**

```bash
curl "http://localhost:3000/api/images?cow_id=BO&behavior=standing&barn_area=A1"
```

**Query Parameters (optional):**
- `cow_id`: Partial match (ILIKE %query%)
- `behavior`: Exact match
- `barn_area`: Partial match (ILIKE %query%)

**Response:**
```json
{
  "data": [
    {
      "id": 5,
      "cow_id": "BO-001",
      "behavior": "standing",
      "barn_area": "Chuồng A1",
      "image_url": "/uploads/2026/03/abc123.jpg",
      "captured_at": "2026-03-18T09:30:00.000Z",
      "created_at": "2026-03-18T09:35:22.000Z"
    }
  ]
}
```

### DELETE /api/images/:id
**Delete image + file**

```bash
curl -X DELETE http://localhost:3000/api/images/5
```

**Response:**
```json
{ "success": true }
```

## 🐄 Behavior Types

Supported cow behaviors (used in form and filter):
- `standing` - Cow is standing
- `lying` - Cow is lying down
- `eating` - Cow is eating
- `drinking` - Cow is drinking water
- `walking` - Cow is walking
- `abnormal` - Unusual/abnormal behavior

## 📸 Camera Features

**Single Shot:**
- Click capture button → saves 1 image immediately

**Burst Mode:**
- Long press or hold capture button → continuous shots (~1 per 500ms)
- Release button to stop
- All images in burst saved with same metadata
- UI shows count of images captured in session

## 💾 Database Schema

```sql
CREATE TABLE cow_images (
  id SERIAL PRIMARY KEY,
  cow_id VARCHAR(100) NOT NULL,         -- Cow identifier
  behavior VARCHAR(50) NOT NULL,         -- standing|lying|eating|...
  barn_area VARCHAR(200),                -- Physical location
  captured_at TIMESTAMP,                 -- When photo was taken
  notes TEXT,                            -- Additional notes
  image_url VARCHAR(500),                -- /uploads/YYYY/MM/uuid.jpg
  file_name VARCHAR(255),                -- uuid.jpg
  file_size INTEGER,                     -- Bytes
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_cow_images_cow_id ON cow_images (cow_id);
CREATE INDEX idx_cow_images_behavior ON cow_images (behavior);
CREATE INDEX idx_cow_images_created_at ON cow_images (created_at DESC);
```

## 🔧 Development

### Running Locally

```bash
# Start in dev mode (auto-reload on file changes)
npm run dev

# Or production mode
npm start

# Check Node process
npm ls
```

### File Upload Limits
- **Max size**: 10MB (configurable in server.js)
- **Format**: JPG, PNG, WebP (all images accepted)
- **Storage**: Local folder `uploads/YYYY/MM/uuid.ext`

### Environment Variables

```env
PORT=3000                              # Express server port
DB_HOST=localhost                      # PostgreSQL host
DB_PORT=5432                          # PostgreSQL port
DB_NAME=cow_visioning                 # Database name
DB_USER=cowapp                        # Database user
DB_PASSWORD=your_secure_password      # Database password
UPLOAD_DIR=./uploads                  # Image storage directory
```

## 🚢 Deployment

### Automated Deployment (GitHub Actions)

1. **Setup VPS:**
   - Follow [DEPLOYMENT.md](./DEPLOYMENT.md) prerequisites section
   - Create application user (`cowapp`)
   - Install Node.js, PostgreSQL, Nginx, PM2

2. **Add GitHub Secrets:**
   - Go to repo → Settings → Secrets and variables → Actions
   - Add: `DEPLOY_KEY`, `VPS_HOST`, `VPS_USER`

3. **Deploy:**
   ```bash
   git push origin main
   ```
   → Automatically triggers GitHub Actions → Deploys to VPS
   → Auto-runs `schema.sql` for database migrations (safe with `IF NOT EXISTS`)

4. **Monitor:**
   - Check Actions tab in GitHub for deployment logs
   - SSH into VPS: `pm2 logs cow-visioning`

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed setup and troubleshooting.

## 📋 Common Commands

**Server Management (VPS):**
```bash
pm2 restart cow-visioning      # Restart server
pm2 logs cow-visioning         # View logs
pm2 stop cow-visioning         # Stop server
pm2 list                       # Show all processes
```

**Database:**
```bash
# Backup
pg_dump -U cowapp cow_visioning | gzip > backup.sql.gz

# Restore
gunzip < backup.sql.gz | psql -U cowapp cow_visioning
```

**Nginx:**
```bash
sudo nginx -t                  # Test config
sudo systemctl reload nginx    # Reload
sudo systemctl restart nginx   # Restart
```

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| **Port 3000 already in use** | `lsof -i :3000` then `kill -9 <PID>` or `pm2 restart cow-visioning` |
| **PostgreSQL connection error** | Check `.env` credentials, verify `sudo systemctl status postgresql` |
| **Nginx 502 Bad Gateway** | Check `pm2 logs`, verify Express is running |
| **Permission denied (uploads)** | `sudo chown -R cowapp:cowapp uploads/` |

Full troubleshooting guide in [DEPLOYMENT.md](./DEPLOYMENT.md#troubleshooting)

## 📚 Documentation

- **[DEPLOYMENT.md](./DEPLOYMENT.md)** - Complete deployment guide (setup, VPS, GitHub Actions, SSL, backups, monitoring)
- **[Tech.md](./Tech.md)** - Original technical requirements and project notes

## 🔮 Future Features (TODO)

See [DEPLOYMENT.md - TODO section](./DEPLOYMENT.md#tính-năng-chưa-làm-todo) for:
- Automatic backup to Windows laptop
- Monitoring & logging (ELK stack or PM2 Plus)
- Rate limiting & security (helmet, CORS, validation)
- Pagination for large galleries
- Admin dashboard with statistics

## 📄 License



## 👥 Author

Tran Tan Dat

---

**Last Updated:** 2026-03-18
**Version:** 1.0.0 (Self-hosted with auto-deploy)