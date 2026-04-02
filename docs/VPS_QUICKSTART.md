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
- [ ] Trỏ DNS domain về VPS
- [ ] Setup SSL với Let's Encrypt (bắt buộc cho Camera)
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

**Xóa default site (tránh xung đột):**
```bash
rm -f /etc/nginx/sites-enabled/default
```

> **Lưu ý:** File config đã có sẵn `server_name pctsv.io.vn www.pctsv.io.vn`. Nếu dùng domain khác, sửa lại:
> ```bash
> nano /etc/nginx/sites-available/cow-visioning
> # Tìm dòng server_name và thay bằng domain của bạn
> ```

**Test và reload Nginx:**
```bash
nginx -t
systemctl reload nginx
```

✅ **Kết quả mong đợi:** `test successful`

---

## Step 1️⃣6️⃣: Trỏ DNS domain về VPS

⚠️ **Phải làm bước này TRƯỚC khi chạy certbot!**

### Tại nhà cung cấp domain (TinoHost / Azdigi / ...)

Vào trang quản lý DNS, thêm 2 bản ghi:

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | `@` (hoặc tên domain) | IP VPS (vd: `180.93.2.32`) | 600 |
| A | `www` | IP VPS (vd: `180.93.2.32`) | 600 |

### Kiểm tra DNS đã lan truyền

```bash
# Chờ 5-30 phút, rồi kiểm tra
nslookup pctsv.io.vn 8.8.8.8
```

✅ **Kết quả mong đợi:**
```
Name:    pctsv.io.vn
Address:  180.93.2.32
```

### ⚠️ Lỗi thường gặp với DNS

**Lỗi: DNS timeout / không resolve**

Kiểm tra có **bản ghi xung đột** không. Ví dụ thực tế đã gặp:
- Domain trước đó trỏ về **Vercel** → tồn tại bản ghi ALIAS cũ
- Bản ghi A (VPS) + ALIAS (Vercel) **xung đột** → DNS timeout hoàn toàn

**Cách fix:**
1. Xóa **tất cả** bản ghi cũ (ALIAS, CNAME trỏ về hosting cũ)
2. Chỉ giữ 2 bản ghi A trỏ về VPS IP
3. Nếu bản ghi cũ bị khóa (trên Vercel có icon 🔒): **chuyển nameserver** về nhà cung cấp domain gốc trước

**Lỗi: Nameserver trỏ sai**

Nếu nameserver đang trỏ về Vercel (`ns1.vercel-dns.com`), bản ghi tại nhà cung cấp sẽ **không có tác dụng**.

```bash
# Check nameserver
nslookup -type=NS pctsv.io.vn
```

Fix: Đổi nameserver về mặc định của nhà cung cấp domain.

---

## Step 1️⃣7️⃣: Setup SSL với Let's Encrypt

⚠️ **BẮT BUỘC cho Camera!** Trình duyệt chặn webcam (`getUserMedia`) trên HTTP. Không có SSL = camera không hoạt động.

**Yêu cầu:**
- DNS đã trỏ domain về VPS (Step 16 ✅)
- Nginx đang chạy
- Port 80 + 443 đã mở

```bash
# Mở port trên firewall (nếu dùng ufw)
ufw allow 80
ufw allow 443

# Cài certbot
apt install -y certbot python3-certbot-nginx
```

**Tip: Test staging trước (tránh bị rate limit):**
```bash
certbot --nginx --staging -d pctsv.io.vn -d www.pctsv.io.vn
# Nếu thành công → chạy lại production (không có --staging)
```

**Cấp SSL certificate production:**
```bash
certbot --nginx -d pctsv.io.vn -d www.pctsv.io.vn
```

Khi được hỏi:
- **Email**: Gõ email (nhận thông báo cert sắp hết hạn)
- **Agree to terms**: `Y`
- **Redirect HTTP to HTTPS**: chọn `2` (tự động redirect — recommend)

**Kiểm tra SSL hoạt động:**
```bash
# Test auto-renew (cert tự gia hạn mỗi 90 ngày)
certbot renew --dry-run

# Kiểm tra HTTPS response
curl -I https://pctsv.io.vn
```

✅ **Kết quả mong đợi:** `HTTP/2 200` hoặc `HTTP/1.1 200 OK`

### Lỗi thường gặp với Certbot

| Lỗi | Nguyên nhân | Fix |
|-----|-------------|-----|
| `Challenge failed` | DNS chưa trỏ về VPS | Quay lại Step 16, check `nslookup` |
| `Connection refused` | Nginx chưa chạy / port 80 bị chặn | `systemctl start nginx` + `ufw allow 80` |
| `Too many requests` | Chạy certbot quá nhiều lần | Chờ 1 giờ, dùng `--staging` lần sau |
| `Could not bind port 80` | Apache/service khác chiếm port | `lsof -i :80` → stop service đó |
| Cert hết hạn | Auto-renew lỗi | `certbot renew --force-renewal` |

---

## Step 1️⃣8️⃣: Test ứng dụng

**Từ máy tính cá nhân, mở browser:**
```
https://pctsv.io.vn
```

> ⚠️ **Phải dùng HTTPS** để camera hoạt động!

**Test các chức năng:**
- [ ] Mở tab "Upload" → Upload ảnh
- [ ] Mở tab "Camera" → Chụp ảnh / Burst Mode (phải có HTTPS!)
- [ ] Mở tab "Gallery" → Xem ảnh
- [ ] Mở tab "Export" → Export CSV/JSON

✅ **Thành công:** Tất cả tab hoạt động, ảnh được lưu, camera cho phép truy cập webcam

---

## Step 1️⃣9️⃣: Setup GitHub Actions auto-deploy

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

## Step 2️⃣0️⃣: Test auto-deploy

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
| **DNS timeout / không resolve** | Xóa bản ghi ALIAS/CNAME cũ, chỉ giữ A record. Check: `nslookup pctsv.io.vn 8.8.8.8` |
| **DNS xung đột (A + ALIAS)** | Xóa ALIAS cũ (Vercel). Nếu bị khóa → đổi nameserver về nhà cung cấp domain gốc |
| **Camera không hoạt động** | Phải dùng HTTPS! Chạy certbot lấy SSL certificate (Step 17) |
| **Certbot challenge failed** | DNS chưa trỏ về VPS. Chờ propagation, check `nslookup domain 8.8.8.8` |
| **Certbot rate limit** | Dùng `--staging` để test trước, chờ 1 giờ nếu bị limit |
| **Cannot connect to database** | Kiểm tra `.env` password, chạy `psql -U cowapp -d cow_visioning` |
| **npm install failed** | Chạy `npm cache clean --force` rồi thử lại |
| **Nginx 502 error** | Check `pm2 logs cow-visioning`, đảm bảo server chạy: `pm2 list` |
| **Port 3000 in use** | `pm2 stop cow-visioning` rồi `pm2 start ecosystem.config.js` |
| **Firewall chặn kết nối** | `ufw allow 22 && ufw allow 80 && ufw allow 443 && ufw enable` |

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
