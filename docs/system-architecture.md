# Cattle Action: System Architecture

**Last Updated**: 2026-04-07  
**Version**: 1.0

---

## 4-Layer Architecture Overview

The Cattle Action system is organized in 4 distinct layers with clear responsibilities:

1. **Presentation Layer** - Web frontend (HTML/CSS/Vanilla JS)
2. **Business Logic Layer** - Express.js backend API
3. **Data & AI Layer** - PostgreSQL database + Python FastAPI AI service
4. **Infrastructure Layer** - Nginx reverse proxy, PM2 process manager, VPS

---

## Component Diagram

```
User (Browser)
    │ HTTPS
    ▼
Nginx (Port 80/443)
    │ HTTP
    ▼
Express.js Server (Port 3000)
    ├─ Auth Middleware
    ├─ Image Upload Handler
    ├─ Gallery API
    ├─ Blog API
    └─ Admin API
    │
    ├─ PostgreSQL Database (Port 5432)
    │  └─ 8 tables
    │
    └─ FastAPI AI Service (Port 8001)
       ├─ YOLOv8 Model
       └─ OpenCV Annotation
```

---

## Data Flow: Image Upload to Detection

```
1. User submits image via upload form
   ├─ File saved to /uploads/original/YYYY/MM/uuid.jpg
   ├─ Metadata extracted (cow_id, behavior, barn_area)
   │
2. Express calls AI Service
   ├─ POST /predict with image path
   │
3. AI Service processes image
   ├─ Load YOLOv8 model
   ├─ Run inference
   ├─ Filter by thresholds (conf, IoU)
   ├─ Draw bounding boxes (OpenCV)
   ├─ Encode result (base64/file)
   │
4. AI Service returns JSON
   ├─ detections[] with confidence scores
   ├─ annotated image path
   │
5. Express stores results
   ├─ Save to cow_images table
   ├─ Return to frontend
   │
6. Frontend updates gallery automatically
   └─ Show annotated image + behavior classification
```

---

## Database Schema Relationships

```
users (1)
  ├─ (many) cow_images
  ├─ (many) blog_posts
  ├─ (many) blog_comments
  └─ (many) blog_likes

blog_posts (1)
  ├─ (many) blog_comments
  ├─ (many) blog_likes
  └─ (many) blog_post_images

session (auto-managed by connect-pg-simple)
app_config (system-wide settings)
```

---

## Authentication & Session Flow

```
Register (public)
    │
    ├─ POST /auth/register
    ├─ Validate input (username, password)
    ├─ Hash password with bcryptjs
    ├─ Store in users table
    │
Login (public)
    │
    ├─ POST /auth/login
    ├─ Verify username + password
    ├─ Create session (7-day expiry)
    ├─ Store session in PostgreSQL
    ├─ Send session cookie to browser
    │
Protected routes (authenticated)
    │
    ├─ Middleware: authRequired()
    ├─ Check req.session.userId
    ├─ Allow or deny based on role
    │
Logout (authenticated)
    │
    ├─ POST /auth/logout
    ├─ Delete session from DB
    ├─ Clear cookie
    └─ Redirect to login page
```

---

## File Upload & Storage

```
Public/js/upload.js (frontend)
    │ Multipart form
    ▼
POST /api/images (Express)
    │ Multer middleware
    ├─ Validate MIME type (image/*)
    ├─ Check file size (≤10MB)
    ├─ Generate UUID filename
    │
    ▼
/uploads/original/YYYY/MM/uuid.ext
    │ Pass to AI service
    ▼
Python FastAPI (port 8001)
    │ YOLOv8 inference + OpenCV annotation
    │
    ▼
/uploads/annotated/YYYY/MM/uuid-annotated.ext (if needed)
    │
    ▼
PostgreSQL cow_images table
    └─ image_url, behavior, confidence, etc.
```

---

## AI Inference Architecture

```
YOLOv8 Detection Pipeline
    │
    ├─ Input: Image file path
    │
    ├─ Model Loading
    │  └─ bounding_cattle_v1_22es.pt (or ONNX)
    │
    ├─ Preprocessing
    │  ├─ Resize to model input (640x640 typical)
    │  ├─ Normalize pixel values
    │  └─ Optional: send base64 if remote AI
    │
    ├─ Inference
    │  ├─ Forward pass through YOLO
    │  ├─ Get raw detections
    │  └─ Device: CPU or CUDA (configurable)
    │
    ├─ Postprocessing
    │  ├─ Apply confidence threshold (0.25 default)
    │  ├─ Apply IoU threshold (0.45 default)
    │  ├─ Limit max detections (50 default)
    │  └─ Map class indices to behavior names
    │
    ├─ Annotation (OpenCV)
    │  ├─ Draw bounding boxes
    │  ├─ Add class labels + confidence %
    │  ├─ Save annotated image
    │  └─ Encode as JPEG or base64
    │
    └─ Output
       ├─ JSON: detections with coordinates & confidence
       └─ Image: annotated version with boxes
```

---

## Behavior Classification (6 Classes)

```
YOLOv8 output classes:
    0 = standing  (upright on four legs)
    1 = lying     (lying down, normal rest)
    2 = eating    (head at feed trough)
    3 = drinking  (at water source)
    4 = walking   (moving/mobile)
    5 = abnormal  (unusual behavior - injury, prolonged lying)

Confidence filtering:
    Detections with confidence < 0.25 are discarded
    IoU overlap < 0.45 are merged
    Only top 50 detections kept per image
```

---

## Admin Dashboard Flow

```
Admin logs in
    │
    ├─ /admin/users
    │  ├─ List users (role, created_at)
    │  ├─ Change user role (user → admin)
    │  └─ Delete user account
    │
    ├─ /admin/ai-settings
    │  ├─ Update AI_CONF_THRESHOLD
    │  ├─ Update AI_IOU_THRESHOLD
    │  ├─ Switch device (cpu/cuda)
    │  ├─ View current config
    │  └─ Settings persist in app_config table
    │
    └─ /admin/stats
       ├─ Total images uploaded
       ├─ Images by behavior
       ├─ Total users
       └─ System health
```

---

## Error Handling Strategy

```
Error Source
    │
    ├─ Client-side (bad input)
    │  └─ HTTP 400: Invalid request
    │
    ├─ Authentication
    │  ├─ HTTP 401: Not logged in
    │  └─ HTTP 403: No permission
    │
    ├─ Not Found
    │  └─ HTTP 404: Resource doesn't exist
    │
    ├─ Server-side (backend error)
    │  └─ HTTP 500: Internal error
    │
└─ Logging
   ├─ console.error() → pm2 logs
   ├─ No sensitive data (passwords, tokens)
   └─ Include context (function, operation, error message)
```

---

## Security Boundaries

```
┌─ Unauthenticated Access ─┐
│ • POST /auth/register     │
│ • POST /auth/login        │
│ • GET /api/version        │
│ • GET /static/* (public)  │
└───────────────────────────┘

┌─ User Role ─────────────┐
│ • POST /api/images       │
│ • GET /api/images        │
│ • All blog operations    │
│ • User profile access    │
└──────────────────────────┘

┌─ Admin Role ────────────┐
│ • /admin/users/*         │
│ • /admin/ai-settings/*   │
│ • /admin/stats           │
│ • Delete any post/image  │
└──────────────────────────┘
```

---

## Deployment Architecture

```
VPS (180.93.2.32) Ubuntu
│
├─ Nginx (External Port 80/443)
│  ├─ SSL Certificate (Let's Encrypt)
│  ├─ Reverse proxy → Express :3000
│  ├─ Serve static files
│  └─ CORS headers
│
├─ PM2 (Process Manager)
│  ├─ Start Node.js app
│  ├─ Auto-restart on crash
│  ├─ Manage logs
│  └─ Health monitoring
│
├─ Express.js (Internal Port 3000)
│  ├─ API routes
│  ├─ Multer upload handler
│  ├─ Database queries
│  └─ AI service calls
│
├─ FastAPI (Internal Port 8001)
│  ├─ YOLO model inference
│  ├─ OpenCV annotation
│  └─ Health endpoint
│
├─ PostgreSQL (Internal Port 5432)
│  ├─ 8 tables
│  ├─ Connection pool
│  └─ Automated backups (manual currently)
│
└─ File Storage (/home/cowapp/myapp/uploads/)
   ├─ /original/YYYY/MM/ (user uploads)
   ├─ /blog/YYYY/MM/ (blog images)
   └─ /annotated/YYYY/MM/ (AI-annotated)
```

---

## Performance Optimization Points

```
Frontend:
    ├─ Lazy load gallery images
    ├─ Relative URLs (serve from same host)
    └─ Minify CSS/JS (future)

Backend:
    ├─ Database indexes on cow_id, behavior, created_at
    ├─ Connection pooling (min 2, max 10)
    ├─ API response caching (future)
    └─ Async job queue for large batches (future)

AI Service:
    ├─ Model cached in memory
    ├─ Batch inference (future)
    ├─ GPU acceleration if available (cuda)
    └─ Parallel image processing (future)

Database:
    ├─ Pagination for large result sets (future)
    ├─ Archive old images (future)
    └─ Replication/failover (future)
```

---

## Monitoring & Alerts

```
Health Checks:
    ├─ Express API /api/version
    ├─ Database connectivity (startup check)
    ├─ AI service /health endpoint
    ├─ Disk space (/uploads/)
    └─ PM2 process status

Logging:
    ├─ Express console.log/error
    ├─ PM2 logs (persistent)
    ├─ Nginx access/error logs
    ├─ Database query logs
    └─ Application errors (catch blocks)

Future Monitoring:
    ├─ ELK Stack (Elasticsearch, Logstash, Kibana)
    ├─ PM2 Plus
    ├─ Sentry (error tracking)
    └─ Prometheus (metrics)
```

---

**Last Updated**: 2026-04-07  
**Version**: 1.0
