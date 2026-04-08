Bạn là Senior UI/UX Designer + Senior Frontend Developer.

Tôi có một website chủ đề **AI Livestock / Smart Cattle Monitoring Platform** tên là **Con Bò Cười**. Đây là hệ thống phục vụ:

- giám sát hành vi bò bằng AI,
- thu thập ảnh dataset,
- camera trực tiếp,
- thư viện ảnh,
- xuất dữ liệu,
- blog cộng đồng,
- admin quản lý người dùng và cấu hình AI,
- auth đăng nhập / đăng ký.

## Bối cảnh hiện tại

Website hiện đã có HTML/CSS/JS và đang hoạt động, nhưng giao diện chưa thật sự đồng bộ, còn pha trộn nhiều phong cách:

- có landing page kiểu marketing,
- có dashboard/app page,
- có auth page riêng,
- có blog,
- có admin panel,
- có camera panel,
- có gallery và export table.

Tôi muốn **nâng cấp toàn bộ giao diện** theo hướng:

- hiện đại,
- cao cấp,
- đồng bộ nhận diện thương hiệu,
- đậm chất công nghệ AI trong nông nghiệp,
- chuyên nghiệp như một sản phẩm SaaS thương mại hóa,
- nhưng vẫn thân thiện với người dùng trang trại.

## Yêu cầu quan trọng

1. **Không phá vỡ logic JS hiện có**
   - giữ nguyên `id`, `class` quan trọng đang được JS sử dụng nếu cần
   - không đổi tên các hook DOM đang được file JS gọi tới
   - không làm hỏng tab switching, upload, camera, gallery, export, blog, admin, auth

2. **Không thay đổi flow chức năng**
   - vẫn giữ các màn hình:
     - Trang chủ
     - Thu thập ảnh
     - Camera trực tiếp
     - Thư viện
     - Xuất dữ liệu
     - Blog
     - Admin
     - Đăng nhập / Đăng ký / Setup auth

3. **Chỉ nâng cấp UI/UX**
   - bố cục
   - typography
   - spacing
   - màu sắc
   - card
   - button
   - form
   - modal
   - table
   - empty state
   - hover/focus/active state
   - responsive mobile/tablet/desktop
   - visual hierarchy
   - dashboard feel
   - tính nhất quán toàn hệ thống

---

# Định hướng thiết kế mong muốn

## 1. Phong cách tổng thể

Thiết kế theo phong cách:

- **AgriTech SaaS hiện đại**
- kết hợp giữa:
  - AI / Data / Dashboard
  - Smart Farming
  - tính đáng tin cậy của enterprise software
- cảm giác:
  - sạch
  - mạnh
  - công nghệ
  - cao cấp
  - rõ ràng
  - dễ thao tác ngoài thực tế

## 2. Visual concept

Tạo một design system mới thống nhất với:

- màu chủ đạo: xanh teal / xanh công nghệ / xanh đậm
- màu nền: sáng hoặc dark-light hybrid, nhưng phải chuyên nghiệp
- sử dụng glassmorphism nhẹ, không lạm dụng
- shadow mềm
- bo góc hiện đại
- icon style đồng bộ
- cảm giác “AI dashboard for modern farms”

## 3. Nhận diện thương hiệu

Tên thương hiệu: **Con Bò Cười**
Tagline gợi ý:

- AI Livestock Monitoring Platform
- Smart Cattle Data & Monitoring
- Nền tảng giám sát bò thông minh

Giữ tinh thần:

- nông nghiệp hiện đại
- AI / Computer Vision
- dữ liệu
- tự động hóa
- giám sát 24/7

---

# Mục tiêu nâng cấp theo từng khu vực

## A. Trang chủ / Landing page

Thiết kế lại landing page để trông giống website sản phẩm startup/SaaS chuyên nghiệp.

### Yêu cầu

- Hero section thật ấn tượng
- headline mạnh, rõ giá trị
- subheadline dễ hiểu
- CTA rõ ràng
- số liệu nổi bật đẹp hơn
- section vấn đề ngành chăn nuôi
- section tính năng AI
- section quy trình hoạt động
- section bài viết / nghiên cứu
- section CTA cuối trang
- footer đẹp và chuyên nghiệp hơn

### Cần cải thiện

- typography rõ thứ bậc hơn
- khoảng trắng tốt hơn
- hình ảnh, overlay, card đồng bộ hơn
- CTA nổi bật hơn
- phần stats trông giống enterprise metrics
- sections cần có nhịp điệu thị giác tốt hơn

---

## B. Khu vực app chính (Thu thập ảnh / Camera / Gallery / Export / Blog / Admin)

Làm lại theo chuẩn **modern web app dashboard**.

### Yêu cầu

- top navigation hoặc app shell rõ ràng hơn
- tab active nổi bật hơn
- layout có nhịp tốt
- page heading nhất quán
- card thống nhất
- khoảng cách giữa các section gọn gàng
- trạng thái loading / success / error đẹp hơn
- cảm giác sản phẩm thương mại chuyên nghiệp

---

## C. Thu thập ảnh (Upload)

Thiết kế lại form upload cho đẹp và dễ dùng hơn.

### Yêu cầu

- form 2 cột desktop, 1 cột mobile
- dropzone đẹp, hiện đại, chuyên nghiệp
- preview ảnh đẹp hơn
- progress bar đẹp hơn
- AI result card trông “smart” hơn
- button upload nổi bật
- validation state rõ ràng
- focus state tốt
- form section nên trông như một khối nghiệp vụ quan trọng

---

## D. Camera trực tiếp

Đây là màn hình rất quan trọng, cần nâng cấp mạnh.

### Yêu cầu

- camera view trông hiện đại như app monitoring
- control bar đẹp hơn
- nút shutter premium hơn
- settings panel rõ ràng hơn
- saved images strip đẹp hơn
- trạng thái “đang lưu”, “đã chụp”, “AI result” trực quan hơn
- nếu được, thêm cảm giác live-monitoring / edge AI / real-time

### UX mong muốn

- thao tác nhanh
- ít rối
- dễ dùng trên màn hình lớn lẫn mobile
- cảm giác sản phẩm camera AI chuyên nghiệp

---

## E. Gallery

Thiết kế gallery như media management dashboard.

### Yêu cầu

- filter bar đẹp hơn
- card ảnh đồng bộ
- badge hành vi rõ ràng, dễ phân biệt
- metadata dễ đọc hơn
- link ảnh gốc / ảnh bbox đẹp hơn
- nút xoá an toàn, rõ ràng
- empty state khi chưa có dữ liệu
- loading skeleton nếu hợp lý

---

## F. Export dữ liệu

Làm lại khu vực export theo phong cách data table chuyên nghiệp.

### Yêu cầu

- action buttons rõ hierarchy
- record count nổi bật
- table đẹp hơn, dễ đọc hơn
- sticky header nếu hợp lý
- zebra row hoặc hover row tốt
- link xem ảnh rõ ràng
- mobile responsive hợp lý

---

## G. Blog

Làm lại blog theo style social feed / community knowledge hub hiện đại.

### Yêu cầu

- composer modal đẹp hơn
- feed card gọn hơn nhưng sang hơn
- preview pane đẹp hơn
- comments section rõ ràng
- side rails đẹp hơn
- bài viết dễ đọc
- khoảng trắng tốt
- CTA tương tác (like/comment/edit/delete) rõ ràng

### Mục tiêu

Blog phải trông như một phần thật sự chuyên nghiệp của platform, không phải phần phụ.

---

## H. Admin Panel

Thiết kế lại admin theo hướng enterprise dashboard.

### Yêu cầu

- stat cards đẹp hơn
- AI settings card rõ ràng
- slider đẹp hơn
- toggle switch hiện đại
- table user management đẹp hơn
- status message chuyên nghiệp
- phân cấp thông tin tốt
- admin panel phải tạo cảm giác kiểm soát hệ thống AI thật sự

---

## I. Auth pages

Thiết kế lại login/register/setup page theo cùng design system.

### Yêu cầu

- card auth premium hơn
- input đẹp hơn
- CTA rõ ràng
- code verification input đẹp hơn
- setup steps rõ hơn
- QR / secret / instruction block đẹp hơn
- đồng bộ visual với landing + dashboard

---

# Yêu cầu kỹ thuật frontend

## 1. Giữ tương thích với code hiện tại

- Không được xóa các `id` đang được JS sử dụng
- Nếu đổi class để đẹp hơn thì vẫn phải đảm bảo JS đang chạy không bị lỗi
- Không làm hỏng:
  - `switchTab(...)`
  - upload form
  - camera controls
  - gallery filters
  - export buttons
  - blog post form / comments
  - admin settings
  - auth form

## 2. Cấu trúc CSS

Hãy:

- refactor CSS cho sạch hơn
- tách design tokens rõ ràng
- gom màu, spacing, radius, shadow vào `:root`
- chuẩn hóa naming
- loại bỏ style trùng lặp
- sửa các phần thiếu nhất quán
- xử lý xung đột giữa nhiều phong cách CSS khác nhau
- nếu phát hiện conflict hoặc CSS dư thừa thì dọn lại

## 3. Responsive

Thiết kế responsive tốt cho:

- desktop lớn
- laptop
- tablet
- mobile

## 4. Accessibility

Cải thiện:

- contrast
- focus state
- hover state
- button clarity
- form readability
- keyboard-friendly interactions

---

# Kết quả tôi muốn bạn trả về

Hãy trả về theo cấu trúc sau:

## Phần 1: Đánh giá UI hiện tại

- phân tích điểm mạnh
- phân tích điểm yếu
- chỉ ra những phần thiếu đồng bộ
- chỉ ra những phần cần ưu tiên nâng cấp trước

## Phần 2: Định hướng redesign

- mô tả concept tổng thể
- màu sắc
- typography
- spacing
- card/button/form/table/modal style
- icon và hình ảnh nên dùng thế nào

## Phần 3: Kế hoạch nâng cấp theo từng trang

- landing page
- upload
- camera
- gallery
- export
- blog
- admin
- auth

## Phần 4: CSS/HTML refactor proposal

- nên sửa file nào trước
- nên chuẩn hóa biến CSS ra sao
- nên tổ chức lại style thế nào
- phần nào nên gộp, phần nào nên tách

## Phần 5: Code triển khai

- viết lại CSS nâng cấp
- nếu cần thì chỉnh HTML tối thiểu để UI đẹp hơn
- nhưng phải giữ tương thích với JS cũ
- ưu tiên cung cấp code hoàn chỉnh, có thể thay trực tiếp

## Phần 6: Giải thích thay đổi

- giải thích vì sao từng thay đổi giúp UI tốt hơn
- giải thích vì sao không phá logic cũ

---

# Lưu ý thêm

Nếu phát hiện:

- CSS bị conflict,
- phong cách landing và dashboard không đồng nhất,
- auth page tách biệt quá nhiều,
- blog/admin nhìn chưa cùng hệ sinh thái,
thì hãy chủ động đề xuất cách hợp nhất thành **1 design language duy nhất**.

Mục tiêu cuối cùng:
Biến website này thành một sản phẩm có giao diện đủ tốt để:

- giới thiệu với khách hàng,
- và có cảm giác gần với sản phẩm thương mại thật.
