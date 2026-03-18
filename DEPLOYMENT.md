# Cow-Visioning Deployment Guide

## Tổng quan dự án

**Cow-Visioning** là web app quản lý dataset ảnh bò cho AI training.
- **Upload ảnh**: Drag-drop hoặc form
- **Camera**: Chụp từ webcam (có Burst Mode)
- **Gallery**: Xem, tìm kiếm, xóa ảnh
- **Export**: CSV/JSON dataset

---

## Kiến trúc hiện tại

### Stack công nghệ
| Lớp | Công nghệ |
|-----|-----------|
| Frontend | HTML/CSS/JavaScript vanilla |
| Backend | Node.js + Express |
| Database | PostgreSQL |
| Upload | Multer (local folder) |
| Web server | Nginx (reverse proxy) |
| Process manager | PM2 |
| Deployment | GitHub Actions → VPS Ubuntu |

### Cấu trúc thư mục
```
myapp/
├── public/                    # Frontend files
│   ├── index.html
│   ├── css/style.css
│   ├── js/
│   │   ├── api-config.js      # Config (BEHAVIOR_MAP)
│   │   ├── app.js             # Tab navigation
│   │   ├── upload.js          # Upload form
│   │   ├── camera.js          # Camera + Burst Mode
│   │   ├── gallery.js         # Gallery + delete
│   │   └── export.js          # CSV/JSON export
│   └── uploads/               # Uploaded images (YYYY/MM/uuid.jpg)
├── server.js                  # Express server (150 dòng)
├── package.json               # Dependencies
├── .env                       # Database credentials (local)
├── .env.example               # Template
├── schema.sql                 # Database DDL
├── ecosystem.config.js        # PM2 config
├── nginx-cow-visioning.conf   # Nginx reverse proxy
├── .github/workflows/deploy.yml # GitHub Actions CI/CD
└── DEPLOYMENT.md              # Tài liệu này
```

---

## API Endpoints

Server chạy trên `localhost:3000` (hoặc VPS:3000)

### POST /api/images
**Upload ảnh + metadata một lần**
```bash
curl -X POST http://localhost:3000/api/images \
  -F "image=@photo.jpg" \
  -F "cow_id=BO-001" \
  -F "behavior=standing" \
  -F "barn_area=Chuồng A1" \
  -F "captured_at=2026-03-18T09:30:00Z" \
  -F "notes=Test ảnh"
```
Response: `{ "success": true, "data": { id, cow_id, image_url, ... } }`

### GET /api/images
**Lấy danh sách ảnh với filter**
```bash
curl "http://localhost:3000/api/images?cow_id=BO&behavior=standing&barn_area=A1"
```
Query params (optional):
- `cow_id`: Tìm kiếm mã bò (ILIKE %query%)
- `behavior`: Filter hành vi chính xác
- `barn_area`: Tìm kiếm khu vực (ILIKE %query%)

Response: `{ "data": [ { id, cow_id, behavior, image_url, ... }, ... ] }`

### DELETE /api/images/:id
**Xóa ảnh + file**
```bash
curl -X DELETE http://localhost:3000/api/images/5
```
Response: `{ "success": true }`

---

## Database Schema

### Table: cow_images
```sql
CREATE TABLE cow_images (
    id SERIAL PRIMARY KEY,
    cow_id VARCHAR(100) NOT NULL,
    behavior VARCHAR(50) NOT NULL,      -- standing|lying|eating|drinking|walking|abnormal
    barn_area VARCHAR(200),              -- Chuồng A1, etc
    captured_at TIMESTAMP,               -- Thời gian chụp ảnh
    notes TEXT,                          -- Ghi chú
    image_url VARCHAR(500),              -- /uploads/2026/03/uuid.jpg
    file_name VARCHAR(255),              -- uuid.jpg
    file_size INTEGER,                   -- Bytes
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_cow_images_cow_id ON cow_images (cow_id);
CREATE INDEX idx_cow_images_behavior ON cow_images (behavior);
CREATE INDEX idx_cow_images_created_at ON cow_images (created_at DESC);
```

---

## Setup Local Development

### Prerequisites
- Node.js 16+
- PostgreSQL 12+
- npm hoặc yarn

### 1. Clone & Install
```bash
git clone <repo-url>
cd cow-visioning
npm install
```

### 2. Database Setup
```bash
# Tạo user PostgreSQL
sudo -u postgres createuser cowapp

# Tạo database
sudo -u postgres createdb cow_visioning -O cowapp

# Chạy schema
psql -U cowapp -d cow_visioning -f schema.sql
```

### 3. Config Environment
```bash
cp .env.example .env
nano .env
```
Điền:
```env
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=cow_visioning
DB_USER=cowapp
DB_PASSWORD=your_secure_password
UPLOAD_DIR=./uploads
```

### 4. Run Server
```bash
npm start
# hoặc dev mode: npm run dev (cần nodemon)
```
Server sẽ chạy ở `http://localhost:3000`

---

## DNS & Domain Setup

### Trỏ domain về VPS

**Domain hiện tại:** `pctsv.io.vn` → VPS IP: `180.93.2.32`
**Nhà cung cấp domain:** TinoHost (hoặc Azdigi)

#### Bước 1: Cấu hình DNS tại nhà cung cấp domain

Vào trang quản lý DNS của nhà cung cấp, thêm 2 bản ghi:

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | `@` (hoặc tên domain) | `180.93.2.32` | 600-3600 |
| A | `www` | `180.93.2.32` | 600-3600 |

#### Bước 2: Kiểm tra DNS đã lan truyền

```bash
# Dùng Google DNS để check (chờ 5-30 phút sau khi thêm record)
nslookup pctsv.io.vn 8.8.8.8
```

Kết quả mong đợi:
```
Name:    pctsv.io.vn
Address:  180.93.2.32
```

#### Lỗi thường gặp với DNS

**Lỗi 1: Xung đột bản ghi DNS (A vs ALIAS/CNAME)**

Nếu trước đó domain từng trỏ về Vercel (hoặc hosting khác), có thể tồn tại bản ghi ALIAS/CNAME cũ xung đột với bản ghi A mới:

| Record xung đột | Triệu chứng |
|-----------------|-------------|
| A record → VPS IP **+** ALIAS record → Vercel | DNS timeout, không resolve được |
| Nhiều A record trỏ về IP khác nhau | Kết nối không ổn định, random IP |

**Cách fix:**
1. Xóa **tất cả** bản ghi cũ (ALIAS, CNAME) trỏ về hosting cũ
2. Chỉ giữ lại 2 bản ghi A trỏ về VPS IP
3. Nếu bản ghi cũ bị khóa (icon 🔒 trên Vercel): chuyển nameserver về nhà cung cấp domain gốc

**Lỗi 2: Nameserver vẫn trỏ về hosting cũ**

Nếu nameserver đang trỏ về Vercel (`ns1.vercel-dns.com`), bản ghi DNS tại nhà cung cấp domain sẽ **không có tác dụng**. Phải đổi nameserver về mặc định của nhà cung cấp trước.

```bash
# Kiểm tra nameserver hiện tại
nslookup -type=NS pctsv.io.vn
```

**Lỗi 3: DNS chưa lan truyền**

DNS có thể mất 5-30 phút (hoặc lên đến 48h với TTL cao). Kiểm tra bằng:
```bash
# Check qua nhiều DNS server
nslookup pctsv.io.vn 8.8.8.8        # Google DNS
nslookup pctsv.io.vn 1.1.1.1        # Cloudflare DNS
nslookup pctsv.io.vn 208.67.222.222 # OpenDNS
```

---

## Deployment to Ubuntu VPS

> **👉 Người mới bắt đầu?** Xem [VPS_QUICKSTART.md](./VPS_QUICKSTART.md) để có hướng dẫn từng bước chi tiết từ SSH đầu tiên!

Phần này cung cấp overview. Để theo dõi chi tiết từng bước, tham khảo VPS_QUICKSTART.md.

### Prerequisites on VPS
```bash
# SSH vào VPS
ssh user@180.93.2.32

# Cài Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Cài PostgreSQL
sudo apt-get install -y postgresql postgresql-contrib

# Cài Nginx
sudo apt-get install -y nginx

# Cài PM2 globally
sudo npm install -g pm2
```

### 1. Create Application User
```bash
sudo useradd -m -s /bin/bash cowapp
sudo su - cowapp
```

### 2. Clone Repository
```bash
cd ~
git clone <repo-url> myapp
cd myapp
```

### 3. Setup PostgreSQL
```bash
sudo -u postgres psql << EOF
CREATE USER cowapp WITH PASSWORD 'your_secure_password';
CREATE DATABASE cow_visioning OWNER cowapp;
EOF

# Chạy schema
sudo -u cowapp psql -d cow_visioning -f schema.sql
```

### 4. Setup Application
```bash
cd ~/myapp
cp .env.example .env
nano .env  # Điền DB_PASSWORD và các config khác

npm install --production
mkdir -p uploads logs
```

### 5. Start with PM2
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup systemd -u cowapp --hp /home/cowapp
```

### 6. Configure Nginx
```bash
sudo cp nginx-cow-visioning.conf /etc/nginx/sites-available/cow-visioning
sudo ln -s /etc/nginx/sites-available/cow-visioning /etc/nginx/sites-enabled/

# Xóa default site nếu có (tránh xung đột)
sudo rm -f /etc/nginx/sites-enabled/default

# Test & reload
sudo nginx -t
sudo systemctl reload nginx
```

> **Lưu ý:** File `nginx-cow-visioning.conf` đã có sẵn `server_name pctsv.io.vn www.pctsv.io.vn`. Nếu dùng domain khác, sửa lại trước khi copy.

### 7. Setup SSL (Let's Encrypt) - BẮT BUỘC cho Camera

⚠️ **Camera (webcam) yêu cầu HTTPS** — trình duyệt chặn `getUserMedia()` trên HTTP. Không có SSL = camera không hoạt động.

**Yêu cầu trước khi chạy certbot:**
- DNS đã trỏ domain về VPS IP (xem phần [DNS & Domain Setup](#dns--domain-setup))
- Nginx đã chạy và listen port 80
- Port 80 và 443 đã mở trên firewall

```bash
# Cài certbot
sudo apt-get install -y certbot python3-certbot-nginx

# Cấp SSL certificate
sudo certbot --nginx -d pctsv.io.vn -d www.pctsv.io.vn
```

Khi được hỏi:
- **Email**: nhập email của bạn (dùng nhận thông báo hết hạn cert)
- **Agree to terms**: `Y`
- **Redirect HTTP to HTTPS**: chọn `2` (tự động redirect — recommend)

**Kiểm tra SSL:**
```bash
# Test auto-renew (cert tự gia hạn mỗi 90 ngày)
sudo certbot renew --dry-run

# Kiểm tra HTTPS
curl -I https://pctsv.io.vn
```

**Kết quả mong đợi:** Status `HTTP/2 200` hoặc `HTTP/1.1 200 OK`

#### Lỗi thường gặp với SSL/Certbot

| Lỗi | Nguyên nhân | Cách fix |
|-----|-------------|----------|
| `Challenge failed` | DNS chưa trỏ về VPS | Chờ DNS propagation, kiểm tra `nslookup domain 8.8.8.8` |
| `Connection refused` | Nginx không chạy hoặc port 80 bị chặn | `sudo systemctl start nginx` + mở port 80 trên firewall |
| `Too many requests` | Chạy certbot quá nhiều lần | Chờ 1 giờ, dùng `--staging` để test trước |
| `Could not bind to port 80` | Apache hoặc service khác chiếm port | `sudo lsof -i :80` → stop service đó |
| Certificate hết hạn | Auto-renew bị lỗi | `sudo certbot renew --force-renewal` |

**Tip:** Test trước với staging để không bị rate limit:
```bash
sudo certbot --nginx --staging -d pctsv.io.vn -d www.pctsv.io.vn
# Nếu OK, chạy lại không có --staging
```

---

## GitHub Actions Auto-Deploy

### Prerequisites
1. **Tạo Deploy Key trên VPS**
```bash
ssh-keygen -t ed25519 -f ~/.ssh/github_deploy -C "github-deploy"
cat ~/.ssh/github_deploy.pub >> ~/.ssh/authorized_keys
cat ~/.ssh/github_deploy  # Copy content
```

2. **Thêm GitHub Secrets**
Vào GitHub repo → Settings → Secrets and variables → Actions
```
DEPLOY_KEY = (nội dung private key từ trên)
VPS_HOST = your_vps_ip_or_domain
VPS_USER = cowapp
```

### Workflow
Khi push code lên `main`:
```bash
git push origin main
```
↓ GitHub Actions trigger (.github/workflows/deploy.yml)
↓ SSH vào VPS, pull code, npm install, pm2 restart
↓ ✅ Server tự động update

### Check Deployment Status
- **GitHub**: Actions tab → xem log của workflow
- **VPS**: `pm2 logs cow-visioning`

---

## Production Checklist

Những gì cần làm trước deploy:

- [ ] PostgreSQL đã cài & chạy trên VPS
- [ ] Database `cow_visioning` đã tạo & schema.sql đã chạy
- [ ] `.env` trên VPS có DB_PASSWORD chính xác
- [ ] `npm install --production` đã chạy
- [ ] PM2 đã start server: `pm2 start ecosystem.config.js`
- [ ] Nginx config đã cấu hình & reload
- [ ] SSL certificate đã setup (Let's Encrypt)
- [ ] GitHub Deploy Key đã thêm vào Secrets
- [ ] `.github/workflows/deploy.yml` đã push lên repo

---

## Tính năng chưa làm (TODO)

### 1. Backup tự động sang Windows Laptop
**Kế hoạch**: Dùng rsync từ VPS → Windows 24/7

Script trên VPS (`/home/cowapp/backup.sh`):
```bash
#!/bin/bash
rsync -avz --progress \
  /home/cowapp/myapp/uploads/ \
  windows_user@windows_ip:/d/backups/cow-visioning/uploads/

# Dump database
pg_dump -U cowapp cow_visioning | gzip > \
  /tmp/cow_db_$(date +%Y%m%d_%H%M%S).sql.gz

# Đẩy backup
scp /tmp/cow_db_*.sql.gz \
  windows_user@windows_ip:/d/backups/cow-visioning/db/
```

Cron job (chạy mỗi giờ):
```bash
0 * * * * /home/cowapp/backup.sh >> /var/log/cow-backup.log 2>&1
```

### 2. Monitoring & Logging
**TODO**:
- Setup ELK stack (Elasticsearch, Logstash, Kibana)
- hoặc dùng PM2 Plus
- Alert khi server down

### 3. Rate Limiting & Security
**TODO**:
- Add rate limiter (express-rate-limit)
- Add CORS config
- Add input validation (joi/yup)
- Add helmet security headers

### 4. Pagination cho Gallery
**TODO**: Vì có nhiều ảnh, cần phân trang thay vì load tất cả

**Frontend change**:
```javascript
// public/js/gallery.js
const page = 1, limit = 20;
const res = await fetch(`/api/images?page=${page}&limit=${limit}&...`);
```

**Backend change**:
```javascript
// server.js - GET /api/images
const limit = parseInt(req.query.limit) || 20;
const offset = (page - 1) * limit;
const sql = `SELECT * FROM cow_images ... LIMIT $1 OFFSET $2`;
```

### 5. Admin Dashboard
**TODO**: Xem stats (tổng ảnh, ảnh theo hành vi, thống kê khu vực)

---

## Common Tasks

### Restart Server
```bash
pm2 restart cow-visioning
# hoặc
pm2 restart ecosystem.config.js
```

### Check Logs
```bash
pm2 logs cow-visioning
# hoặc
pm2 logs cow-visioning --lines 50
```

### View Process Status
```bash
pm2 list
pm2 show cow-visioning
```

### Stop Server
```bash
pm2 stop cow-visioning
```

### Delete All PM2 Processes (danger!)
```bash
pm2 delete all
```

### Check Disk Usage (uploads folder)
```bash
du -sh ~/myapp/uploads/
```

### Manual Database Backup
```bash
pg_dump -U cowapp cow_visioning | gzip > cow_db_backup_$(date +%Y%m%d).sql.gz
```

### Restore Database
```bash
gunzip < cow_db_backup_20260318.sql.gz | psql -U cowapp cow_visioning
```

---

## Troubleshooting

### DNS không resolve / timeout
```bash
# Kiểm tra DNS
nslookup pctsv.io.vn 8.8.8.8

# Nếu timeout → kiểm tra:
# 1. Bản ghi DNS có đúng chưa (A record → VPS IP)
# 2. Có bản ghi xung đột không (ALIAS/CNAME cũ trỏ về Vercel/hosting khác)
# 3. Nameserver có đang trỏ về nhà cung cấp domain không
nslookup -type=NS pctsv.io.vn
```

**Fix:** Xóa tất cả bản ghi cũ, chỉ giữ 2 bản ghi A:
- `@` → `180.93.2.32`
- `www` → `180.93.2.32`

### Camera không hoạt động (getUserMedia error)
```
NotAllowedError: Permission denied
# hoặc
TypeError: Cannot read properties of undefined (reading 'getUserMedia')
```

**Nguyên nhân:** Trình duyệt **chặn camera trên HTTP**. Chỉ HTTPS hoặc localhost mới cho phép `getUserMedia()`.

**Fix:** Setup SSL certificate (xem phần [Setup SSL](#7-setup-ssl-lets-encrypt---bắt-buộc-cho-camera))

### Port 3000 already in use
```bash
# Tìm process
lsof -i :3000
# Kill process
kill -9 <PID>
# hoặc restart PM2
pm2 restart cow-visioning
```

### PostgreSQL connection error
```bash
# Check PostgreSQL status
sudo systemctl status postgresql
sudo systemctl start postgresql

# Check .env credentials
cat ~/myapp/.env | grep DB_

# Test kết nối trực tiếp
psql -U cowapp -d cow_visioning -c "SELECT 1;"
```

### Nginx 502 Bad Gateway
```bash
# Check if Express is running
pm2 list
pm2 logs cow-visioning --lines 20

# Check Nginx config
sudo nginx -t
sudo systemctl status nginx

# Check port forwarding
curl http://127.0.0.1:3000
```

### Certbot SSL thất bại
```bash
# Check DNS đã trỏ chưa
nslookup pctsv.io.vn 8.8.8.8

# Check Nginx đang chạy
sudo systemctl status nginx

# Check port 80 có bị chặn không
sudo ufw status
sudo ufw allow 80
sudo ufw allow 443

# Test với staging trước
sudo certbot --nginx --staging -d pctsv.io.vn -d www.pctsv.io.vn

# Nếu bị rate limit, chờ 1 giờ rồi thử lại
```

### Permission denied when writing uploads
```bash
# Ensure correct ownership
sudo chown -R cowapp:cowapp /home/cowapp/myapp/uploads
sudo chmod -R 755 /home/cowapp/myapp/uploads
```

### Firewall chặn kết nối
```bash
# Xem firewall rules
sudo ufw status

# Mở các port cần thiết
sudo ufw allow 22    # SSH
sudo ufw allow 80    # HTTP (certbot cần)
sudo ufw allow 443   # HTTPS
sudo ufw enable
```

---

## References

- [Express.js Docs](https://expressjs.com)
- [Multer Documentation](https://github.com/expressjs/multer)
- [PM2 Manual](https://pm2.keymetrics.io)
- [PostgreSQL Docs](https://www.postgresql.org/docs)
- [Nginx Docs](https://nginx.org/en/docs)
- [GitHub Actions](https://docs.github.com/en/actions)

---

**Last Updated**: 2026-03-18
**Maintained by**: Your Team
