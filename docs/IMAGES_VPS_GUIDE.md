# 🗺️ Hướng dẫn Cấu hình Truy cập Ảnh từ VPS (Sạch & Linh hoạt)

Tài liệu này tổng hợp quá trình chúng ta đã thực hiện để chuyển đổi từ đường dẫn ảnh có cổng `:3000` (không ổn định) sang đường dẫn trực tiếp qua IP/Domain: `http://180.93.2.32/uploads/...` hoặc `https://pctsv.io.vn/uploads/...`.

---

## 1. Dọn dẹp Database (Bản ghi ma)

Khi bạn chạy Server ở Local nhưng kết nối DB của VPS, các bản ghi ảnh (Records) được lưu vào VPS nhưng file thật lại nằm ở máy Windows. Điều này khiến Web trên VPS báo có ảnh nhưng thực tế không thấy file (Lỗi 404).

### ✅ Hành động: Chạy Script dọn dẹp trên VPS
Sử dụng script `vps_prune.js` để quét toàn bộ DB và xóa những bản ghi không có file thực tế trên đĩa cứng VPS.

*   **Vị trí:** `/home/cowapp/myapp/scripts/vps_prune.js`
*   **Lệnh chạy:** `node scripts/vps_prune.js` (Từ thư mục `~/myapp`)

---

## 2. Cấu hình Nginx (Phục vụ Ảnh trực tiếp)

Nginx giúp bạn truy cập ảnh mà không cần thông qua cổng `:3000`. Nó nhanh hơn và cho phép dùng SSL (HTTPS).

### ✅ File cấu hình: `/etc/nginx/sites-available/cow-visioning`
Đảm bảo có khối lệnh sau để Nginx "nhận diện" thư mục ảnh:

```nginx
location /uploads/ {
    alias /home/cowapp/myapp/uploads/;
    expires 30d;
    add_header Cache-Control "public, immutable";
}
```

*   **server_name:** Sử dụng `server_name pctsv.io.vn www.pctsv.io.vn 180.93.2.32 _;` để hệ thống tự động nhận diện cả IP và Tên miền.

---

## 3. Phân quyền Hệ thống (Sửa lỗi 403 Forbidden)

Mặc định Ubuntu chặn Nginx truy cập vào thư mục của người dùng cá nhân (`/home/cowapp/`).

### ✅ Lệnh cấp quyền (Chạy trên VPS):
```bash
# Cho phép Nginx đi xuyên qua các lớp thư mục
sudo chmod o+x /home/cowapp
sudo chmod o+x /home/cowapp/myapp

# Cấp quyền đọc file cho toàn bộ thư mục ảnh
sudo chmod -R 755 /home/cowapp/myapp/uploads
```

---

## 4. Cấu hình Code & Môi trường (.env)

Chúng ta đã nâng cấp logic trong `server.js` để hệ thống tự động sinh ra đường dẫn (URL) thông minh.

### ✅ Quy tắc mới:
*   **Trên VPS:** Luôn dùng đường dẫn tương đối (Relative Path) như `/uploads/...`. Trình duyệt sẽ tự động ghép với Domain/IP hiện tại bạn đang dùng -> Luôn sạch và tự cập nhật khi đổi domain.
*   **Tại Local:** Tự động ghép IP VPS vào trước để bạn vẫn xem được dữ liệu VPS khi đang lập trình ở máy Windows.

### ✅ Cấu hình file `.env`:

1.  **Tại máy Local (Windows):**
    ```env
    # Dùng để trỏ về VPS lấy ảnh (Không kèm :3000)
    VPS_URL=http://180.93.2.32
    # Hoặc nếu dùng domain: VPS_URL=https://pctsv.io.vn
    ```

2.  **Trên máy VPS (Ubuntu):**
    ```env
    # XÓA HOẶC COMMENT DÒNG NÀY ĐỂ MÃ NGUỒN TỰ ĐỘNG DÙNG ĐƯỜNG DẪN TƯƠNG ĐỐI
    # VPS_URL=...
    ```

---

## 🚀 Cách vận hành chuẩn sau này:

1.  **Lập trình (Local):** Bạn code ở máy Windows, ảnh sẽ tự động được lấy từ VPS qua IP sạch.
2.  **Đưa lên VPS:** Chỉ cần `git push` (nếu có GitHub Actions) hoặc `git pull`.
3.  **Xem ảnh trực tiếp:** Bạn có thể copy link ảnh và gửi cho người khác, nó sẽ luôn ở dạng chuyên nghiệp nhất: `https://pctsv.io.vn/uploads/original/2026/03/filename.jpg`

---
*Tài liệu được khởi tạo ngày: 27/03/2026 - Bởi Hệ thống Cow-Visioning.*
