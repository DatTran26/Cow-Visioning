# Hướng Dẫn Cấu Hình Kết Nối Database PostgreSQL Trên VPS

Tài liệu này hướng dẫn chi tiết các bước cấu hình để kết nối ứng dụng từ môi trường Local (Máy tính cá nhân) tới cơ sở dữ liệu PostgreSQL đang chạy trên máy chủ ảo (VPS).

---

## 1. Cấu hình tại phía VPS (Server)

Mọi tệp cấu hình của PostgreSQL 14 thường nằm tại đường dẫn: `/etc/postgresql/14/main/`

### Bước 1.1: Cho phép lắng nghe kết nối từ mọi IP
Mở tệp `postgresql.conf`:
```bash
sudo nano /etc/postgresql/14/main/postgresql.conf
```
Tìm và sửa dòng `listen_addresses`:
- **Trước:** `listen_addresses = 'localhost'`
- **Sau:** `listen_addresses = '*'`

### Bước 1.2: Phân quyền truy cập từ bên ngoài
Mở tệp `pg_hba.conf`:
```bash
sudo nano /etc/postgresql/14/main/pg_hba.conf
```
Thêm dòng này vào cuối cùng của tệp:
```text
host    all             all             0.0.0.0/0               md5
```
*(Lưu ý: Bạn có thể thay `0.0.0.0/0` bằng IP cụ thể của máy tính cá nhân để tăng tính bảo mật).*

### Bước 1.3: Áp dụng thay đổi
Khởi động lại dịch vụ PostgreSQL:
```bash
sudo systemctl restart postgresql@14-main
```
Kiểm tra trạng thái cluster:
```bash
sudo pg_lsclusters
```
*Phải đảm bảo trạng thái (Status) hiển thị là **`online`**.*

---

## 2. Cấu hình Tường lửa (Firewall)

Để kết nối thông suốt, cổng **5432** phải được mở ở cả hai lớp tường lửa:

1. **Lớp 1 (Trong hệ điều hành VPS):**
   ```bash
   sudo ufw allow 5432/tcp
   sudo ufw status (Kiểm tra xem đã có dòng 5432/tcp ALLOW chưa)
   ```

2. **Lớp 2 (Trang quản trị của nhà cung cấp VPS):**
   Đăng nhập vào bảng điều khiển (Dashboard) của nhà cung cấp (AWS, Vultr, DigitalOcean...) -> Tìm mục **Networking** hoặc **Firewall/Security Groups** -> Thêm quy tắc **Allow Inbound TCP 5432**.

---

## 3. Cấu hình tại máy tính cá nhân (Client/Local)

### Bước 3.1: Thiết lập tệp môi trường `.env`
Đảm bảo tệp `.env` trỏ đúng địa chỉ IP của VPS:
```env
DB_HOST=180.93.2.32
DB_PORT=5432
DB_NAME=cow_visioning
DB_USER=cowapp
DB_PASSWORD=hd123456
```

### Bước 3.2: Điều chỉnh mã nguồn (server.js)
Vì kết nối qua Internet có độ trễ cao hơn kết nối nội mạng, hãy cấu hình tham số `connectionTimeoutMillis` trong đối tượng `Pool` của thư viện `pg`:
```javascript
const pool = new Pool({
    // ... các thông tin khác
    connectionTimeoutMillis: 10000, // Tối thiểu 10 giây để tránh lỗi Timeout
});
```

---

## 4. Kiểm tra và Troubleshooting

Trước khi chạy ứng dụng, bạn có thể kiểm tra xem máy mình đã "thấy" Database trên VPS chưa bằng lệnh PowerShell:
```powershell
Test-NetConnection 180.93.2.32 -Port 5432
```
- Nếu **`TcpTestSucceeded : True`**: Kết nối hoàn tất, có thể chạy ứng dụng (`npm run dev`).
- Nếu **`TcpTestSucceeded : False`**: Tường lửa (Firewall) lớp 1 hoặc lớp 2 vẫn đang chặn kết nối.

---
*Tài liệu này được tạo vào ngày: 27/03/2026*
