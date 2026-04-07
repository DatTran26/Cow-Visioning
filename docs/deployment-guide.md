# Cattle Action: Deployment Guide

**Last Updated**: 2026-04-07  
**Version**: 1.0  
**Scope**: VPS deployment to Ubuntu server via PM2 + Nginx

---

## Quick Reference

**VPS Details**: 180.93.2.32 (Ubuntu 20.04 LTS)  
**Domain**: pctsv.io.vn (TinoHost DNS)  
**User**: cowapp (non-root, for security)  
**App Path**: /home/cowapp/myapp  
**DB**: PostgreSQL 14 (local on VPS)  
**Ports**: 3000 (Express), 8001 (FastAPI), 5432 (PostgreSQL)  
**Process Manager**: PM2  
**Web Server**: Nginx (reverse proxy + SSL)  

---

## Prerequisites

### On Your Local Machine
- Git installed and configured
- SSH client (Windows: PuTTY or Git Bash)
- Terminal/command line access

### On VPS
- Ubuntu 20.04+ LTS
- Root or sudo access (for initial setup)
- 2GB+ RAM, 10GB+ disk space

---

## Step 1: Initial VPS Setup (Root)

### 1.1 SSH Access
```bash
# From local machine
ssh root@180.93.2.32

# You'll be prompted for password (from hosting provider)
```

### 1.2 Create Application User
```bash
# As root, create user 'cowapp'
sudo useradd -m -s /bin/bash cowapp
sudo usermod -aG sudo cowapp

# Set password
sudo passwd cowapp

# Create SSH key for GitHub (optional but recommended)
sudo su - cowapp
ssh-keygen -t ed25519 -f ~/.ssh/github_deploy -C "github-deploy"
cat ~/.ssh/github_deploy.pub  # Add to GitHub Deploy Keys (repo settings)
```

### 1.3 Install Dependencies
```bash
# Update package list
sudo apt-get update
sudo apt-get upgrade -y

# Install Node.js 18+ (LTS)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PostgreSQL 14
sudo apt-get install -y postgresql postgresql-contrib

# Install Nginx
sudo apt-get install -y nginx

# Install PM2 globally
sudo npm install -g pm2

# Install Python + pip (for AI service)
sudo apt-get install -y python3 python3-pip

# Install certbot for SSL
sudo apt-get install -y certbot python3-certbot-nginx
```

### 1.4 Configure Firewall
```bash
# Enable firewall
sudo ufw enable

# Allow SSH, HTTP, HTTPS
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Allow PostgreSQL (internal only - skip this or restrict to localhost)
# sudo ufw allow 5432/tcp

# Check firewall status
sudo ufw status
```

---

## Step 2: PostgreSQL Setup

### 2.1 Create Database User & Database
```bash
# Switch to postgres user
sudo -u postgres psql

# Inside psql prompt:
CREATE USER cowapp WITH PASSWORD 'your_secure_password_here';
CREATE DATABASE cow_visioning OWNER cowapp;
\q  # Exit psql
```

### 2.2 Allow Remote Connections (VPS Only)
```bash
# Enable remote connections if needed
sudo nano /etc/postgresql/14/main/postgresql.conf

# Find and change:
# listen_addresses = 'localhost'
# TO:
listen_addresses = '*'

# Edit pg_hba.conf for firewall rules
sudo nano /etc/postgresql/14/main/pg_hba.conf

# Add at end:
host    all             all             0.0.0.0/0               md5

# Restart PostgreSQL
sudo systemctl restart postgresql
```

### 2.3 Initialize Database Schema
```bash
# As cowapp user
sudo -u cowapp psql -d cow_visioning -f schema.sql
```

---

## Step 3: Clone Repository & Setup App

### 3.1 Clone Repo (As cowapp User)
```bash
sudo su - cowapp
cd ~
git clone https://github.com/your-username/Cow-Visioning.git myapp
cd myapp
```

### 3.2 Install Node Dependencies
```bash
npm install --production  # Production mode only
```

### 3.3 Setup Environment
```bash
# Copy example environment file
cp .env.example .env

# Edit .env with actual values
nano .env

# Fill in:
DB_HOST=localhost
DB_PORT=5432
DB_NAME=cow_visioning
DB_USER=cowapp
DB_PASSWORD=your_secure_password_here
PORT=3000
NODE_ENV=production
SESSION_SECRET=generate_random_string_here
AI_SERVICE_URL=http://127.0.0.1:8001
```

### 3.4 Create Uploads Directory
```bash
mkdir -p uploads/original uploads/blog uploads/annotated
chmod 755 uploads
```

---

## Step 4: PM2 Process Manager Setup

### 4.1 Start with PM2
```bash
# As cowapp user in myapp directory
pm2 start ecosystem.config.js

# Save PM2 process list
pm2 save

# Setup PM2 startup (auto-start on reboot)
pm2 startup systemd -u cowapp --hp /home/cowapp
# Follow the output instruction to run as root
```

### 4.2 Verify PM2 Status
```bash
pm2 list           # Show running processes
pm2 logs app       # Show logs (last 10 lines)
pm2 monit          # Real-time monitoring (Ctrl+C to exit)
```

---

## Step 5: Nginx Configuration

### 5.1 Create Nginx Config
```bash
# As root or with sudo
sudo nano /etc/nginx/sites-available/cow-visioning
```

Paste this config:
```nginx
server {
    listen 80;
    listen [::]:80;
    server_name pctsv.io.vn www.pctsv.io.vn;

    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name pctsv.io.vn www.pctsv.io.vn;

    # SSL certificates (populated by certbot)
    ssl_certificate /etc/letsencrypt/live/pctsv.io.vn/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/pctsv.io.vn/privkey.pem;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "SAMEORIGIN" always;

    # Proxy to Express (port 3000)
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
```

### 5.2 Enable Nginx Config
```bash
# Create symlink
sudo ln -s /etc/nginx/sites-available/cow-visioning /etc/nginx/sites-enabled/

# Remove default site if present
sudo rm -f /etc/nginx/sites-enabled/default

# Test Nginx config
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

---

## Step 6: SSL Certificate Setup (CRITICAL for Camera)

**⚠️ Webcam requires HTTPS** — browsers block getUserMedia() on HTTP!

### 6.1 Prerequisites
- Domain (pctsv.io.vn) must already point to VPS IP (180.93.2.32)
- Verify DNS: `nslookup pctsv.io.vn 8.8.8.8` should return VPS IP
- Port 80 must be open (certbot needs it)

### 6.2 Generate SSL Certificate
```bash
# As root
sudo certbot --nginx -d pctsv.io.vn -d www.pctsv.io.vn

# When prompted:
# Email: your@email.com
# Agree to terms: Y
# Redirect HTTP to HTTPS: 2
```

### 6.3 Verify SSL
```bash
curl -I https://pctsv.io.vn

# Expected output:
# HTTP/2 200
# Strict-Transport-Security: max-age=31536000
```

### 6.4 Auto-Renewal
```bash
# Certbot auto-renews every 90 days (automatic)
# Test dry-run:
sudo certbot renew --dry-run
```

---

## Step 7: AI Service Setup (Python)

### 7.1 Install Python Dependencies
```bash
cd /home/cowapp/myapp
pip3 install -r ai_service/requirements.txt

# Should include: fastapi, uvicorn, ultralytics, opencv-python, torch
```

### 7.2 Start AI Service (Optional - Separate Process)
```bash
# If running AI service on same VPS:
cd /home/cowapp/myapp/ai_service
python3 main.py  # Runs on port 8001

# Or add to PM2 (as cowapp user):
pm2 start ai_service/main.py --name ai-service --interpreter python3
pm2 save
```

### 7.3 Verify AI Service
```bash
curl http://127.0.0.1:8001/health

# Expected: JSON response with status
```

---

## Step 8: GitHub Actions CI/CD

### 8.1 Add GitHub Secrets
1. Go to GitHub repo → Settings → Secrets and variables → Actions
2. Add these secrets:

```
DEPLOY_KEY      = (content of ~/.ssh/github_deploy - private key)
VPS_HOST        = 180.93.2.32 (or pctsv.io.vn)
VPS_USER        = cowapp
```

### 8.2 Workflow File
File: `.github/workflows/deploy.yml`

Already in repo. When you push to `main`:
```yaml
- SSH into VPS as cowapp
- git pull origin main
- npm install --production
- pm2 restart app
- Database auto-migrates (schema.sql)
```

---

## Verification Checklist

After deployment, verify:

### Database
```bash
# Test connection from local machine
psql -h 180.93.2.32 -U cowapp -d cow_visioning -c "SELECT 1"

# Or on VPS:
sudo -u cowapp psql -d cow_visioning -c "SELECT COUNT(*) FROM users"
```

### Express API
```bash
curl https://pctsv.io.vn/api/version

# Should return: {"version":"git-hash"}
```

### Webcam (Critical)
```
1. Open browser to https://pctsv.io.vn
2. Go to "Thu thập ảnh" (Image Collection) tab
3. Click "Chụp ảnh" (Take Photo) button
4. Browser should request camera permission
5. If camera works = HTTP/HTTPS properly configured
```

### SSL Certificate
```bash
# Check expiry
sudo certbot certificates

# Should show "Valid" and not expired
```

---

## Troubleshooting

### "Connection refused" on localhost:3000
```bash
# Check if PM2 process is running
pm2 list

# If not running:
pm2 start ecosystem.config.js

# Check logs:
pm2 logs app
```

### "Database connection timeout"
```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Test connection:
sudo -u cowapp psql -d cow_visioning -c "SELECT 1"

# Check .env credentials match DB setup
cat .env | grep DB_
```

### "404 on /api/images"
```bash
# Nginx not properly routing to Express
# Check nginx config:
sudo nginx -t

# Reload:
sudo systemctl reload nginx

# Test Express directly:
curl http://127.0.0.1:3000/api/images
```

### "Webcam not working (getUserMedia error)"
```
Issue: NotAllowedError: Permission denied

Cause: HTTPS not configured
Fix: 
1. Verify SSL certificate: sudo certbot certificates
2. Force HTTPS in browser
3. Check domain resolves: nslookup pctsv.io.vn 8.8.8.8
```

### "AI Service returns 500"
```bash
# Check AI service is running
curl http://127.0.0.1:8001/health

# Check logs:
pm2 logs ai-service

# Verify model file exists:
ls -lah /home/cowapp/myapp/ai_service/models/

# Check Python dependencies:
pip3 list | grep -E "fastapi|ultralytics|torch"
```

### "Out of disk space"
```bash
# Check usage:
df -h

# Find large files:
du -sh /home/cowapp/myapp/uploads/*

# Archive old uploads:
find /home/cowapp/myapp/uploads/original -type f -mtime +365 -delete
```

---

## Maintenance Tasks

### Daily
- Monitor disk space: `df -h`
- Check PM2 processes: `pm2 list`
- Review error logs: `pm2 logs --err app`

### Weekly
- Backup database: `pg_dump -U cowapp cow_visioning | gzip > backup.sql.gz`
- Check SSL cert expiry: `sudo certbot certificates`

### Monthly
- Update system packages: `sudo apt-get update && sudo apt-get upgrade -y`
- Review log files: `sudo journalctl -u nginx --since "1 month ago"`
- Prune old images (>1 year): `find uploads/original -type f -mtime +365 -delete`

### Quarterly
- Retrain AI model (manual process)
- Security audit (check .env, logs, permissions)
- Performance tuning (DB indexes, caching)

---

## Backup & Recovery

### Automated Backup
```bash
# Create backup script: /home/cowapp/backup.sh
#!/bin/bash
BACKUP_DIR="/home/cowapp/backups"
mkdir -p $BACKUP_DIR

# Backup database
pg_dump -U cowapp cow_visioning | gzip > $BACKUP_DIR/db_$(date +%Y%m%d).sql.gz

# Backup uploads
tar -czf $BACKUP_DIR/uploads_$(date +%Y%m%d).tar.gz /home/cowapp/myapp/uploads/

# Keep only last 30 days
find $BACKUP_DIR -type f -mtime +30 -delete
```

Add to crontab:
```bash
crontab -e

# Add line:
0 2 * * * /home/cowapp/backup.sh
```

### Restore Database
```bash
# From backup file
gunzip < backup.sql.gz | psql -U cowapp cow_visioning
```

---

## Performance Optimization

### Database Tuning
```sql
-- Add indexes for faster queries
CREATE INDEX idx_cow_images_cow_id ON cow_images(cow_id);
CREATE INDEX idx_cow_images_behavior ON cow_images(behavior);
CREATE INDEX idx_cow_images_created_at ON cow_images(created_at DESC);
```

### Nginx Caching
```nginx
# Add to server block (for static assets)
location ~* \.(jpg|jpeg|png|gif|ico|css|js)$ {
    expires 7d;
    add_header Cache-Control "public, immutable";
}
```

### PostgreSQL Settings
```bash
# Edit /etc/postgresql/14/main/postgresql.conf
shared_buffers = 256MB           # 25% of RAM
effective_cache_size = 1GB       # 75% of RAM
maintenance_work_mem = 64MB
work_mem = 16MB
```

---

## Scaling for Phase 2

### Prepare Multi-Farm
- Add `farm_id` to all tables (migration)
- Create farm management endpoints
- Test data isolation

### Load Testing
```bash
# Install Apache Bench
sudo apt-get install apache2-utils

# Test API performance
ab -n 1000 -c 10 https://pctsv.io.vn/api/images

# Expected: <500ms avg response time
```

### Database Replication (Future)
- Primary: 180.93.2.32
- Replica: Secondary VPS (standby)
- Failover: Automated via keepalived

---

**Last Updated**: 2026-04-07  
**Version**: 1.0  
**Next Review**: When scaling to 10+ farms (Phase 2)
