# 🚀 VPS Quick Start - Chi tiết từng bước

**Đối tượng:** Người mới đầu tiên setup VPS Ubuntu cho Cow-Visioning
**Thời gian:** ~30-40 phút
**Yêu cầu:** Có VPS Ubuntu 20.04+ với SSH access

---

## 📋 Danh sách công việc

- [ ] SSH vào VPS
- [ ] Cập nhật hệ thống
- [ ] Cài Node.js
- [ ] Cài PostgreSQL
- [ ] Cài Nginx
- [ ] Cài PM2
- [ ] Tạo application user
- [ ] Clone repository
- [ ] Setup PostgreSQL (database + user)
- [ ] Chạy schema.sql
- [ ] Cấu hình .env
- [ ] Cài npm dependencies
- [ ] Start server với PM2
- [ ] Cấu hình Nginx reverse proxy
- [ ] Setup SSL với Let's Encrypt
- [ ] Test ứng dụng
- [ ] Setup GitHub Actions auto-deploy

---

## Step 1️⃣: SSH vào VPS

**Từ máy tính cá nhân, chạy:**
```bash
ssh root@your_vps_ip
# hoặc nếu dùng key:
ssh -i ~/.ssh/your_key.pem root@your_vps_ip
```

Nếu hỏi "Are you sure?" → gõ `yes` và Enter

✅ **Kết quả mong đợi:** Prompt thành `root@your-server:~#`

---

## Step 2️⃣: Cập nhật hệ thống

```bash
apt update
apt upgrade -y
```

Chờ cho đến khi hoàn thành (~2-3 phút)

✅ **Dấu hiệu hoàn thành:** Quay lại prompt `root@...`

---

## Step 3️⃣: Cài Node.js (v20 LTS)

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
apt install -y nodejs
```

**Kiểm tra cài đặt:**
```bash
node --version
npm --version
```

✅ **Kết quả mong đợi:**
```
v20.x.x
9.x.x
```

---

## Step 4️⃣: Cài PostgreSQL

```bash
apt install -y postgresql postgresql-contrib
```

**Khởi động PostgreSQL:**
```bash
systemctl start postgresql
systemctl enable postgresql
```

**Kiểm tra status:**
```bash
systemctl status postgresql
```

✅ **Kết quả mong đợi:** Có dòng `active (running)`

---

## Step 5️⃣: Cài Nginx

```bash
apt install -y nginx
systemctl start nginx
systemctl enable nginx
```

**Kiểm tra:**
```bash
systemctl status nginx
```

✅ **Kết quả mong đợi:** `active (running)`

---

## Step 6️⃣: Cài PM2 globally

```bash
npm install -g pm2
pm2 -v
```

✅ **Kết quả mong đợi:** Version number (e.g., `5.3.0`)

---

## Step 7️⃣: Tạo application user (cowapp)

```bash
useradd -m -s /bin/bash cowapp
```

**Chuyển sang user cowapp:**
```bash
su - cowapp
```

✅ **Dấu hiệu:** Prompt thành `cowapp@...:~$`

---

## Step 8️⃣: Clone repository

**Trong home của cowapp:**
```bash
cd ~
git clone https://github.com/your-username/cow-visioning.git myapp
cd myapp
```

**Liệt kê file để kiểm tra:**
```bash
ls -la
```

✅ **Kết quả mong đợi:** Thấy `server.js`, `package.json`, `schema.sql`, `public/`, etc.

---

## Step 9️⃣: Setup PostgreSQL (database + user)

**Quay lại user root:**
```bash
exit
# hoặc: sudo su
```

**Tạo database, user, và gán quyền:**
```bash
sudo -u postgres psql << 'EOF'
CREATE DATABASE cow_visioning;
CREATE USER cowapp WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE cow_visioning TO cowapp;
\c cow_visioning
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO cowapp;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO cowapp;
EOF
```

⚠️ **Lưu ý:** Thay `your_secure_password` bằng mật khẩu thực (ví dụ: `Cow@Vision2026!Secure`)

**Kiểm tra database:**
```bash
sudo -u postgres psql -l | grep cow_visioning
```

✅ **Kết quả mong đợi:** Thấy dòng `cow_visioning | cowapp`

---

## Step 🔟: Chạy schema.sql (tạo tables)

**Chuyển sang user cowapp:**
```bash
su - cowapp
cd ~/myapp
```

**Chạy schema:**
```bash
psql -U cowapp -d cow_visioning -f schema.sql
```

Nhập password khi được hỏi → gõ mật khẩu từ Step 9

**Kiểm tra tables:**
```bash
psql -U cowapp -d cow_visioning << EOF
\dt
EOF
```

✅ **Kết quả mong đợi:** Thấy table `cow_images`

---

## Step 1️⃣1️⃣: Tạo file .env

**Từ trong `/home/cowapp/myapp/`:**
```bash
cp .env.example .env
nano .env
```

**Sửa thành (dùng mật khẩu thực từ Step 9):**
```env
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=cow_visioning
DB_USER=cowapp
DB_PASSWORD=your_secure_password
UPLOAD_DIR=./uploads
```

**Lưu file:**
- Ctrl + X
- Gõ `y`
- Enter

✅ **Kiểm tra:**
```bash
cat .env
```

---

## Step 1️⃣2️⃣: Cài npm dependencies

**Trong `/home/cowapp/myapp/`:**
```bash
npm install --production
```

Chờ cho đến khi hoàn thành (~1-2 phút)

✅ **Dấu hiệu:** Thấy `added X packages`

---

## Step 1️⃣3️⃣: Tạo uploads folder với quyền

```bash
mkdir -p uploads logs
chmod -R 755 uploads logs
```

---

## Step 1️⃣4️⃣: Start server với PM2

**Vẫn trong `/home/cowapp/myapp/`:**
```bash
pm2 start ecosystem.config.js
```

**Lưu PM2 startup config:**
```bash
pm2 save
pm2 startup systemd -u cowapp --hp /home/cowapp
```

Sao chép lệnh được output và chạy nó (sẽ có lệnh `sudo` ở đầu)

**Kiểm tra server chạy:**
```bash
pm2 list
pm2 logs cow-visioning --lines 10
```

✅ **Kết quả mong đợi:**
- Status `online` (xanh)
- Logs không có error

---

## Step 1️⃣5️⃣: Cấu hình Nginx reverse proxy

**Quay lại root user:**
```bash
exit
```

**Copy Nginx config:**
```bash
cp /home/cowapp/myapp/nginx-cow-visioning.conf /etc/nginx/sites-available/cow-visioning
ln -s /etc/nginx/sites-available/cow-visioning /etc/nginx/sites-enabled/
```

**Sửa config để thay domain:**
```bash
nano /etc/nginx/sites-available/cow-visioning
```

Tìm và thay `your-domain.com` bằng **domain thực** của bạn (hoặc IP nếu chưa có domain)

Ví dụ:
```nginx
server_name 192.168.1.100;  # Nếu dùng IP VPS
# hoặc
server_name cow-visioning.example.com;  # Nếu có domain
```

**Lưu file và test Nginx config:**
```bash
nginx -t
```

✅ **Kết quả mong đợi:** `test successful`

**Reload Nginx:**
```bash
systemctl reload nginx
```

---

## Step 1️⃣6️⃣: Setup SSL với Let's Encrypt

```bash
apt install -y certbot python3-certbot-nginx
```

**Cấp chứng chỉ SSL (thay domain):**
```bash
certbot --nginx -d your-domain.com
```

**Hoặc nếu dùng IP, bạn có thể bỏ qua SSL lúc này:**
```bash
echo "Skip SSL nếu chưa có domain"
```

Khi được hỏi:
- Email: Gõ email của bạn
- Agree to terms: `Y`
- Share email: `Y` (tuỳ chọn)
- Redirect HTTP to HTTPS: `Y` (recommend)

✅ **Kết quả mong đợi:** Chứng chỉ được cấp, Nginx reload tự động

---

## Step 1️⃣7️⃣: Test ứng dụng

**Từ máy tính cá nhân, mở browser:**
```
http://your_vps_ip:3000
hoặc
https://your-domain.com (nếu có SSL)
```

**Test các chức năng:**
- [ ] Mở tab "Upload" → Upload ảnh
- [ ] Mở tab "Camera" → Chụp ảnh / Burst Mode
- [ ] Mở tab "Gallery" → Xem ảnh
- [ ] Mở tab "Export" → Export CSV/JSON

✅ **Thành công:** Tất cả tab hoạt động, ảnh được lưu

---

## Step 1️⃣8️⃣: Setup GitHub Actions auto-deploy

**Trên VPS (user cowapp), tạo SSH key:**
```bash
su - cowapp
ssh-keygen -t ed25519 -f ~/.ssh/github_deploy -C "github-deploy"
```

Nhấn Enter 2 lần (không đặt passphrase)

**Thêm public key vào authorized_keys:**
```bash
cat ~/.ssh/github_deploy.pub >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

**Lấy private key:**
```bash
cat ~/.ssh/github_deploy
```

Sao chép toàn bộ nội dung (từ `-----BEGIN` đến `-----END`)

---

**Trên GitHub (web browser):**

1. Vào repo → Settings → Secrets and variables → Actions
2. Click "New repository secret"
3. Thêm 3 secrets:

**Secret 1: DEPLOY_KEY**
- Name: `DEPLOY_KEY`
- Value: Paste nội dung private key từ trên
- Click "Add secret"

**Secret 2: VPS_HOST**
- Name: `VPS_HOST`
- Value: IP hoặc domain của VPS (e.g., `192.168.1.100`)
- Click "Add secret"

**Secret 3: VPS_USER**
- Name: `VPS_USER`
- Value: `cowapp`
- Click "Add secret"

---

## Step 1️⃣9️⃣: Test auto-deploy

**Trên máy tính local:**
```bash
# Sửa 1 file nhỏ (e.g., update DEPLOYMENT.md)
git add .
git commit -m "test: verify auto-deploy"
git push origin main
```

**Trên GitHub, xem Actions tab:**
- Thấy workflow chạy (status: In progress)
- Chờ xanh (success) hoặc đỏ (failed)

**Trên VPS kiểm tra logs:**
```bash
su - cowapp
pm2 logs cow-visioning --lines 20
```

✅ **Thành công:** Code tự động pull, npm install, server restart

---

## ✅ Complete Checklist

- [x] SSH vào VPS
- [x] Update hệ thống
- [x] Cài Node.js, PostgreSQL, Nginx, PM2
- [x] Tạo user cowapp
- [x] Clone repo
- [x] Setup database + user
- [x] Chạy schema.sql
- [x] Cấu hình .env
- [x] Start server với PM2
- [x] Cấu hình Nginx
- [x] Setup SSL
- [x] Test ứng dụng
- [x] Setup GitHub Actions

---

## 🆘 Troubleshooting

| Vấn đề | Giải pháp |
|--------|----------|
| **Cannot connect to database** | Kiểm tra `.env` password, chạy `psql -U cowapp -d cow_visioning` |
| **npm install failed** | Chạy `npm cache clean --force` rồi thử lại |
| **Nginx 502 error** | Check `pm2 logs`, đảm bảo server chạy: `pm2 list` |
| **SSL certificate failed** | Kiểm tra domain + DNS pointing, chạy `certbot renew` |
| **Port 3000 in use** | `pm2 stop cow-visioning` rồi `pm2 start ecosystem.config.js` |

---

## 📞 Quick Commands (VPS)

```bash
# SSH vào VPS
ssh root@your_vps_ip

# Chuyển sang cowapp user
su - cowapp

# Vào thư mục app
cd ~/myapp

# Xem logs server
pm2 logs cow-visioning

# Restart server
pm2 restart cow-visioning

# Xem database
psql -U cowapp -d cow_visioning

# Check Nginx
sudo systemctl status nginx
sudo nginx -t
```

---

**Chúc mừng! 🎉 VPS của bạn đã setup xong!**

Lần sau chỉ cần:
1. Push code lên GitHub main branch
2. GitHub Actions tự động deploy
3. Xem `/pm2 logs` để confirm

Nếu có vấn đề, xem [DEPLOYMENT.md - Troubleshooting](./DEPLOYMENT.md#troubleshooting)
