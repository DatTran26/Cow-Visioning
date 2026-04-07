# CATTLE ACTION / CON BÒ CƯỜI
## Tài liệu tổng quan và đặc tả chi tiết dự án

---

## 1. Thông tin chung

- **Tên đề tài học thuật:** CATTLE ACTION
- **Tên sản phẩm định hướng thương mại:** Con Bò Cười
- **Lĩnh vực:** Precision Livestock Farming / Computer Vision / Edge AI / Smart Farming
- **Loại hệ thống:** Nền tảng giám sát hành vi và cảnh báo sức khỏe vật nuôi (bò) bằng Thị giác máy tính, hỗ trợ thu thập dữ liệu, phân tích hành vi, cảnh báo bất thường, quản trị đa trang trại và vận hành thương mại hóa theo mô hình nhiều tổ chức.
- **Đối tượng giám sát chính:** Bò nuôi trong chuồng trại hoặc khu vực chăn nuôi có lắp camera.
- **Mục tiêu thương mại:** Cung cấp nền tảng giám sát cho nhiều nông trại, trong đó mỗi nông trại là một khách hàng riêng, được quản trị theo mô hình phân quyền nhiều cấp.

---

## 2. Tóm tắt dự án

CATTLE ACTION là hệ thống ứng dụng AI và Computer Vision để theo dõi hành vi bò theo thời gian thực thông qua camera. Hệ thống có khả năng phát hiện đối tượng, theo dõi từng cá thể, suy luận hành vi và đưa ra cảnh báo sớm khi có dấu hiệu bất thường như nằm lâu, giảm vận động, va chạm mạnh hoặc húc nhau.

Ở giai đoạn đầu, dự án tập trung vào bài toán kỹ thuật: nhận diện hành vi, theo dõi bò, lưu trữ dữ liệu và gửi cảnh báo. Ở giai đoạn mở rộng, dự án được phát triển theo định hướng **nền tảng thương mại hóa đa trang trại (multi-tenant platform)**, trong đó:

- Bên vận hành nền tảng quản lý toàn hệ thống thông qua **SuperAdmin**.
- Mỗi nông trại có một hoặc nhiều **Admin** do nền tảng cấp hoặc kích hoạt.
- Admin của nông trại có quyền tạo tài khoản **User** cho nhân viên nội bộ.
- **Cục thú y** hoặc cơ quan chuyên môn có thể được cấp quyền giám sát, xem báo cáo theo phạm vi được phê duyệt.
- **Non User** chỉ được truy cập các phần công khai như landing page, giới thiệu sản phẩm, demo và form đăng ký.

Như vậy, dự án không chỉ là một hệ thống AI nhận diện hành vi bò mà còn là một **nền tảng quản trị, phân tích và giám sát chăn nuôi thông minh** có thể triển khai cho nhiều khách hàng cùng lúc.

---

## 3. Bối cảnh và vấn đề thực tế

### 3.1. Bối cảnh ngành chăn nuôi

Trong các trang trại chăn nuôi quy mô vừa và lớn, việc theo dõi sức khỏe và hành vi của đàn bò thường vẫn dựa nhiều vào quan sát thủ công. Cách làm này gây ra nhiều vấn đề:

- Tốn nhân lực giám sát liên tục.
- Khó phát hiện sớm các biểu hiện bất thường.
- Dễ bỏ sót sự kiện nếu nhân viên mệt mỏi hoặc không quan sát đúng thời điểm.
- Không có dữ liệu lịch sử chuẩn hóa để phân tích hoặc huấn luyện mô hình AI sau này.
- Khó mở rộng khi số lượng bò, số chuồng hoặc số camera tăng lên.

### 3.2. Các vấn đề điển hình

Hệ thống hướng tới giải quyết các vấn đề sau:

1. **Bò nằm lâu bất thường** nhưng không được phát hiện sớm, dẫn đến nguy cơ bệnh, thương tích hoặc chết.
2. **Bò húc nhau, va chạm mạnh** gây thương tích, giảm giá trị thương phẩm và ảnh hưởng phúc lợi động vật.
3. **Giám sát thủ công kém hiệu quả**, phụ thuộc vào nhân sự, không bền vững khi quy mô trang trại tăng.
4. **Thiếu dữ liệu chuẩn hóa** về hành vi vật nuôi để phục vụ nghiên cứu, huấn luyện và cải tiến mô hình AI.
5. **Thiếu hệ thống quản lý tập trung** khi muốn triển khai cho nhiều trang trại, nhiều người dùng và nhiều cấp quản trị.

### 3.3. Nhu cầu thực tế

Người dùng mục tiêu cần một hệ thống có khả năng:

- Theo dõi đàn bò liên tục 24/7.
- Phát hiện sớm hành vi bất thường.
- Gửi cảnh báo gần thời gian thực.
- Lưu dữ liệu ảnh/video/sự kiện để truy vết.
- Xuất dữ liệu phục vụ huấn luyện AI.
- Quản lý tài khoản và quyền truy cập theo từng tổ chức.
- Dễ triển khai tại trại, ưu tiên chạy cục bộ bằng Edge AI.

---

## 4. Mục tiêu dự án

### 4.1. Mục tiêu tổng quát

Thiết kế và triển khai một hệ thống AI giám sát hành vi bò theo thời gian thực, có khả năng phát hiện bất thường, hỗ trợ cảnh báo sức khỏe vật nuôi và quản trị tập trung theo mô hình thương mại hóa cho nhiều nông trại.

### 4.2. Mục tiêu cụ thể

1. Xây dựng hệ thống thu nhận dữ liệu từ camera hoặc ảnh/dataset.
2. Huấn luyện và triển khai mô hình AI để phát hiện bò và nhận diện hành vi cơ bản.
3. Theo dõi từng cá thể bằng tracking để tạo dữ liệu chuỗi thời gian.
4. Xây dựng logic suy luận hành vi bất thường dựa trên tín hiệu không gian – thời gian.
5. Lưu trữ sự kiện, hình ảnh, kết quả AI và lịch sử cảnh báo.
6. Cung cấp giao diện Web/App cho người dùng theo từng vai trò.
7. Xây dựng cơ chế phân quyền đa cấp gồm Non User, User, Admin, Cục thú y, SuperAdmin.
8. Tổ chức dữ liệu theo mô hình multi-tenant để thương mại hóa cho nhiều nông trại.
9. Hỗ trợ xuất dữ liệu phục vụ huấn luyện, kiểm định và báo cáo.
10. Đảm bảo hệ thống có thể mở rộng, bảo mật và dễ vận hành thực tế.

---

## 5. Phạm vi dự án

### 5.1. Phạm vi chức năng chính

- Nhận luồng camera hoặc ảnh đầu vào.
- Phát hiện bò trong ảnh/video.
- Theo dõi ID từng bò giữa các frame.
- Nhận diện hoặc suy luận hành vi.
- Phát hiện bất thường và tạo cảnh báo.
- Lưu lịch sử sự kiện, ảnh và metadata.
- Quản lý thư viện ảnh và dữ liệu.
- Quản lý người dùng và phân quyền.
- Quản lý nhiều nông trại trên cùng một nền tảng.
- Dashboard, báo cáo, export dữ liệu.
- Quản trị toàn hệ thống bởi SuperAdmin.

### 5.2. Phạm vi không bao gồm ở phiên bản đầu

- Chẩn đoán bệnh chính xác như một thiết bị y tế chuyên dụng.
- Điều khiển phần cứng chuồng trại tự động như quạt, cổng, robot cho ăn.
- ERP nông nghiệp đầy đủ.
- Tích hợp thanh toán thương mại điện tử hoàn chỉnh nếu chưa cần.
- Phân tích di truyền hoặc truy xuất nguồn gốc sâu.

### 5.3. Phạm vi mở rộng tương lai

- Theo dõi cân nặng ước lượng bằng hình ảnh.
- Nhận diện từng cá thể bằng visual re-identification.
- Thêm mô hình dự báo nguy cơ bệnh.
- Hỗ trợ đa loài vật nuôi.
- SaaS dashboard dành cho cụm trang trại, doanh nghiệp hoặc cơ quan quản lý.

---

## 6. Giá trị cốt lõi của hệ thống

Hệ thống tạo ra giá trị ở 4 tầng:

### 6.1. Giá trị vận hành

- Giảm phụ thuộc vào giám sát thủ công.
- Phát hiện sớm sự cố.
- Rút ngắn thời gian phản ứng.

### 6.2. Giá trị dữ liệu

- Tạo dataset chuẩn hóa từ thực tế.
- Lưu trữ lịch sử hành vi và cảnh báo.
- Phục vụ huấn luyện AI liên tục.

### 6.3. Giá trị quản trị

- Phân quyền rõ ràng theo tổ chức và vai trò.
- Quản trị nhiều người dùng, nhiều nông trại.
- Có nhật ký thao tác phục vụ truy vết.

### 6.4. Giá trị thương mại hóa

- Có thể bán như một nền tảng dịch vụ cho nhiều farm.
- Dễ kiểm soát khách hàng, gói dịch vụ, số lượng tài khoản và phạm vi dữ liệu.
- Dễ mở rộng từ nội bộ sang SaaS hoặc hybrid deployment.

---

## 7. Stakeholders (Các bên liên quan)

### 7.1. Chủ sở hữu nền tảng

Đơn vị phát triển và vận hành hệ thống. Đây là bên chịu trách nhiệm:

- xây dựng sản phẩm,
- quản lý hạ tầng,
- cấp tài khoản Admin cho khách hàng,
- giám sát toàn bộ hệ thống,
- hỗ trợ kỹ thuật,
- mở rộng thương mại hóa.

### 7.2. Nông trại / khách hàng

Là tổ chức sử dụng sản phẩm để giám sát đàn bò của mình.

### 7.3. Chủ nông trại / quản lý trang trại

Là người dùng cấp quản trị trong từng farm, tương ứng vai trò **Admin**.

### 7.4. Nhân viên trang trại

Là người trực tiếp vận hành hằng ngày, tương ứng vai trò **User**.

### 7.5. Cơ quan thú y / Cục thú y

Là bên có thể được cấp quyền xem báo cáo, số liệu hoặc tình trạng dịch bệnh theo phạm vi được phép.

### 7.6. Đội kỹ thuật / AI / vận hành hệ thống

Là nhóm nội bộ chịu trách nhiệm mô hình AI, backend, infrastructure, hỗ trợ khách hàng, kiểm thử và vận hành.

---

## 8. Mô hình người dùng và phân cấp quản trị

Hệ thống sử dụng mô hình phân quyền nhiều cấp, đồng thời hỗ trợ multi-tenant theo từng farm.

### 8.1. Non User

Là người chưa đăng nhập hoặc khách truy cập công khai.

**Mục đích:**
- xem landing page,
- tìm hiểu sản phẩm,
- xem demo,
- gửi form liên hệ hoặc đăng ký dùng thử.

**Không được phép:**
- truy cập dữ liệu nội bộ,
- xem camera,
- xem gallery,
- xem export,
- thao tác hệ thống nghiệp vụ.

### 8.2. User

Là nhân viên của farm, do Admin tạo tài khoản.

**Mục đích:**
- sử dụng hằng ngày,
- upload/chụp ảnh,
- xem cảnh báo,
- xem dữ liệu trong phạm vi farm,
- ghi chú hoặc hỗ trợ xử lý sự kiện.

**Không được phép:**
- tạo người dùng khác,
- truy cập farm khác,
- thay đổi cấu hình toàn hệ thống,
- điều hành tenant.

### 8.3. Admin

Là quản trị viên của từng farm, thường là chủ nông trại hoặc người quản lý được khách hàng ủy quyền.

**Mục đích:**
- quản lý người dùng nội bộ farm,
- quản lý camera, dữ liệu, cảnh báo, cấu hình AI trong phạm vi farm,
- xem dashboard và báo cáo của farm,
- export dữ liệu của farm.

**Đặc điểm:**
- là tài khoản mà nền tảng cấp cho khách hàng,
- không được truy cập farm khác,
- không quản trị được SuperAdmin.

### 8.4. Cục thú y

Là người dùng thuộc cơ quan quản lý chuyên môn, có quyền giám sát ở mức báo cáo hoặc giám sát dữ liệu theo phạm vi.

**Mục đích:**
- xem báo cáo sức khỏe đàn,
- xem cảnh báo dịch bệnh,
- xem thống kê tổng hợp,
- tải báo cáo phục vụ kiểm tra, giám sát.

**Giới hạn quan trọng:**
- chỉ nên có quyền đọc,
- không sửa dữ liệu vận hành farm,
- không tạo user cho farm,
- chỉ xem trong phạm vi được phê duyệt.

### 8.5. SuperAdmin

Là người điều hành cao nhất của nền tảng.

**Mục đích:**
- quản lý toàn bộ hệ thống,
- giám sát tất cả farm,
- cấp/khoá Admin,
- quản lý gói dịch vụ,
- theo dõi log,
- hỗ trợ kỹ thuật,
- can thiệp sự cố,
- giám sát cả Admin và User.

**Đặc điểm:**
- toàn quyền ở cấp nền tảng,
- là vai trò cao nhất,
- chịu trách nhiệm vận hành thương mại hóa.

---

## 9. Mô hình thương mại hóa

### 9.1. Tư duy nền tảng

Hệ thống không chỉ phục vụ một trại duy nhất mà được thiết kế để có thể bán cho nhiều khách hàng. Vì vậy, dữ liệu phải tách biệt theo **farm** hoặc **tenant**.

### 9.2. Quy trình thương mại hóa chuẩn

1. Chủ nền tảng tạo một **Farm** mới trong hệ thống.
2. SuperAdmin cấp hoặc kích hoạt tài khoản **Admin** cho farm đó.
3. Admin đăng nhập và thiết lập dữ liệu ban đầu của farm.
4. Admin tự tạo các tài khoản **User** cho nhân viên trang trại.
5. User sử dụng hệ thống hằng ngày để theo dõi, upload, xem cảnh báo.
6. SuperAdmin giám sát tổng thể và hỗ trợ khi cần.
7. Cục thú y có thể được cấp quyền xem báo cáo hoặc dữ liệu theo khu vực/quyền hạn.

### 9.3. Lợi ích của mô hình này

- Phù hợp để bán cho nhiều khách hàng.
- Dễ quản lý quyền và trách nhiệm.
- Dễ kiểm soát dữ liệu theo từng tổ chức.
- Hỗ trợ mở rộng dịch vụ như gói Basic / Pro / Enterprise.

---

## 10. Mô hình tổ chức dữ liệu: Multi-Tenant

### 10.1. Khái niệm tenant

Mỗi nông trại được coi là một **tenant** hoặc **organization** độc lập.

### 10.2. Ý nghĩa kỹ thuật

Mọi dữ liệu nghiệp vụ phải gắn với `farm_id` hoặc `tenant_id`, ví dụ:

- users
- cameras
- barns
- cattle
- images
- detections
- alerts
- reports
- blog/posts nội bộ nếu cần tách tenant

### 10.3. Nguyên tắc quan trọng

- User và Admin chỉ được nhìn thấy dữ liệu thuộc farm của mình.
- Cục thú y chỉ được thấy dữ liệu trong phạm vi được cấp.
- SuperAdmin có thể thấy dữ liệu toàn hệ thống.
- Không được để dữ liệu khách hàng bị lẫn giữa các farm.

---

## 11. Bài toán nghiệp vụ chính

### 11.1. Giám sát hành vi bò

Hệ thống theo dõi bò qua camera và xác định các hành vi như:

- đứng,
- nằm,
- ăn,
- uống,
- đi lại,
- bất thường.

### 11.2. Phát hiện hành vi bất thường

Từ dữ liệu phát hiện đối tượng, tracking và logic thời gian, hệ thống có thể đánh dấu:

- bò nằm lâu không đứng dậy,
- bò ít di chuyển kéo dài,
- va chạm mạnh giữa hai cá thể,
- tụ đàn bất thường,
- bỏ ăn hoặc thay đổi nhịp hoạt động.

### 11.3. Cảnh báo sức khỏe và an toàn

Khi phát hiện mẫu bất thường, hệ thống sẽ:

1. tạo một sự kiện,
2. lưu ảnh hoặc snapshot,
3. ghi mức độ rủi ro,
4. gửi thông báo cho người có trách nhiệm,
5. hiển thị trên dashboard hoặc ứng dụng.

### 11.4. Thu thập dữ liệu và xây dựng dataset

Ngoài giám sát, hệ thống còn hỗ trợ:

- upload ảnh thủ công,
- chụp ảnh trực tiếp từ camera/webcam,
- lưu metadata,
- gắn nhãn hành vi,
- xuất dữ liệu để huấn luyện AI.

---

## 12. Chức năng tổng thể của hệ thống

Hệ thống có thể chia thành các module sau.

### 12.1. Module Landing / Public Site

Dành cho Non User:

- xem giới thiệu hệ thống,
- xem lợi ích sản phẩm,
- xem tính năng,
- xem bài viết,
- gửi liên hệ,
- đăng ký dùng thử,
- chuyển sang trang đăng nhập/đăng ký.

### 12.2. Module Xác thực và tài khoản

- đăng nhập,
- đăng xuất,
- đổi mật khẩu,
- quên mật khẩu,
- quản lý hồ sơ cá nhân,
- kiểm soát phiên đăng nhập.

### 12.3. Module Quản lý Farm

- tạo farm,
- cập nhật thông tin farm,
- cấu hình tenant,
- kích hoạt/tạm dừng farm,
- gán gói dịch vụ,
- quản lý trạng thái sử dụng.

### 12.4. Module Quản lý người dùng

- tạo tài khoản User,
- gán vai trò,
- khóa/mở tài khoản,
- reset mật khẩu,
- gán phạm vi truy cập,
- theo dõi trạng thái hoạt động.

### 12.5. Module Thu thập dữ liệu ảnh

- upload nhiều ảnh,
- nhập metadata như mã bò, khu vực, thời gian chụp,
- chụp trực tiếp từ camera,
- lưu ảnh gốc,
- hiển thị kết quả AI mới nhất,
- quản lý file preview.

### 12.6. Module Camera trực tiếp

- bật/tắt camera,
- chụp ảnh thủ công,
- burst mode,
- tự động lưu,
- gắn metadata,
- nhận kết quả AI sau khi chụp.

### 12.7. Module AI Detection

- nhận ảnh/video đầu vào,
- gọi mô hình YOLO để phát hiện đối tượng,
- gán nhãn hành vi hoặc lớp đối tượng,
- trả về bounding box, class, confidence.

### 12.8. Module Tracking

- duy trì ID liên tục cho từng bò,
- theo dõi quỹ đạo,
- phục vụ logic hành vi theo thời gian,
- hỗ trợ phân tích biến động vận động.

### 12.9. Module Behavior Logic Engine

- suy luận hành vi từ detection + tracking,
- áp dụng luật không gian – thời gian,
- xác định bất thường,
- sinh sự kiện và mức độ ưu tiên.

### 12.10. Module Cảnh báo

- tạo alert,
- phân loại severity,
- lưu snapshot,
- gửi qua app/web,
- tích hợp Telegram/Zalo OA nếu cần,
- quản lý trạng thái xử lý cảnh báo.

### 12.11. Module Gallery

- hiển thị thư viện ảnh,
- lọc theo mã bò, hành vi, khu vực,
- xem ảnh gốc/ảnh có annotation,
- xóa ảnh nếu được phép,
- tìm kiếm dữ liệu lịch sử.

### 12.12. Module Export dữ liệu

- tải dữ liệu ảnh và metadata,
- xuất CSV,
- xuất JSON,
- chuẩn hóa theo nhu cầu huấn luyện AI,
- lọc theo thời gian/hành vi/farm.

### 12.13. Module Blog / Bài viết / cộng đồng

Tùy định hướng sản phẩm, module này có thể dùng cho:

- thông báo nội bộ,
- chia sẻ bài viết,
- truyền thông thương hiệu,
- hướng dẫn sử dụng,
- trao đổi kinh nghiệm chăn nuôi.

### 12.14. Module Admin Panel

- xem dashboard farm,
- chỉnh cấu hình AI,
- quản lý user nội bộ,
- xem thống kê dữ liệu,
- quản lý cảnh báo.

### 12.15. Module SuperAdmin Panel

- xem tổng quan toàn nền tảng,
- quản lý farm,
- quản lý tài khoản Admin,
- theo dõi log,
- theo dõi tài nguyên hệ thống,
- giám sát hoạt động khách hàng,
- quản lý gói dịch vụ và trạng thái tenant.

### 12.16. Module Báo cáo cho Cục thú y

- xem dashboard tổng hợp,
- lọc theo khu vực,
- xem lịch sử cảnh báo,
- xuất báo cáo,
- hỗ trợ thanh tra hoặc giám sát dịch bệnh.

---

## 13. Use Case tổng quát theo vai trò

### 13.1. Non User

- Xem trang chủ
- Xem tính năng sản phẩm
- Xem blog/tài liệu công khai
- Đăng ký dùng thử
- Gửi thông tin liên hệ
- Đăng nhập / đăng ký

### 13.2. User

- Đăng nhập
- Xem camera / giám sát
- Upload ảnh
- Chụp ảnh từ camera
- Xem kết quả AI
- Xem gallery
- Xem lịch sử cảnh báo
- Xem dữ liệu của farm mình
- Gửi ghi chú xử lý sự kiện
- Cập nhật hồ sơ cá nhân

### 13.3. Admin

- Tạo User
- Quản lý User thuộc farm
- Cấu hình AI của farm
- Xem dashboard farm
- Xem và xử lý cảnh báo
- Quản lý camera/khu chuồng
- Xuất dữ liệu farm
- Xem báo cáo farm
- Quản lý nội dung nội bộ farm

### 13.4. Cục thú y

- Đăng nhập tài khoản chuyên môn
- Xem báo cáo tổng hợp
- Xem cảnh báo bất thường
- Lọc dữ liệu theo khu vực, farm hoặc thời gian
- Tải báo cáo phục vụ quản lý

### 13.5. SuperAdmin

- Tạo farm
- Tạo/kích hoạt/khóa Admin
- Theo dõi toàn nền tảng
- Xem tất cả dữ liệu của các farm
- Theo dõi audit log
- Quản lý gói dịch vụ
- Quản lý giới hạn tài nguyên
- Hỗ trợ xử lý sự cố
- Quản lý quyền cho Cục thú y

---

## 14. Ma trận phân quyền

| Chức năng | Non User | User | Admin | Cục thú y | SuperAdmin |
|---|---|---|---|---|---|
| Xem landing page | Có | Có | Có | Có | Có |
| Đăng nhập hệ thống | Không | Có | Có | Có | Có |
| Xem demo công khai | Có | Có | Có | Có | Có |
| Upload ảnh | Không | Có | Có | Không | Có |
| Chụp ảnh camera | Không | Có | Có | Không | Có |
| Xem gallery farm mình | Không | Có | Có | Giới hạn | Có |
| Xóa dữ liệu ảnh | Không | Hạn chế | Có | Không | Có |
| Xem cảnh báo farm mình | Không | Có | Có | Giới hạn | Có |
| Xử lý cảnh báo | Không | Hạn chế | Có | Không | Có |
| Xuất CSV/JSON | Không | Hạn chế | Có | Có báo cáo | Có |
| Tạo User | Không | Không | Có | Không | Có |
| Quản lý Admin | Không | Không | Không | Không | Có |
| Quản lý farm | Không | Không | Không | Không | Có |
| Xem tất cả farm | Không | Không | Không | Giới hạn | Có |
| Cấu hình AI | Không | Không | Có | Không | Có |
| Xem log hệ thống | Không | Không | Hạn chế | Không | Có |
| Quản lý gói dịch vụ | Không | Không | Không | Không | Có |

**Lưu ý:**
- “Giới hạn” nghĩa là chỉ được xem trong phạm vi được cấp quyền.
- “Hạn chế” nghĩa là có thể được cấp một phần quyền nhỏ thông qua cấu hình permission chi tiết.

---

## 15. Quy tắc nghiệp vụ quan trọng

### 15.1. Quy tắc tổ chức dữ liệu

1. Mỗi user phải thuộc ít nhất một farm, trừ SuperAdmin.
2. Mỗi ảnh, cảnh báo, camera, bài viết nghiệp vụ và dữ liệu AI đều phải gắn với `farm_id`.
3. Admin chỉ được quản lý user trong farm của mình.
4. User không được nhìn thấy dữ liệu của farm khác.
5. Dữ liệu giữa các farm phải tách biệt tuyệt đối.

### 15.2. Quy tắc phân quyền

1. Chỉ SuperAdmin mới được tạo hoặc khóa tài khoản Admin ở cấp nền tảng.
2. Admin chỉ được tạo tài khoản User trong farm mình.
3. Cục thú y chỉ có quyền đọc theo phạm vi được cấp.
4. User không được thay đổi cấu hình hệ thống cấp farm nếu không có quyền mở rộng.
5. Non User không được truy cập module nghiệp vụ nội bộ.

### 15.3. Quy tắc cảnh báo

1. Khi hành vi vượt ngưỡng bất thường, hệ thống phải tạo alert.
2. Alert phải có thời gian phát sinh, mức độ, nguồn camera, farm và ảnh minh chứng nếu có.
3. Alert phải lưu trạng thái như: mới tạo, đã xem, đang xử lý, đã đóng.
4. Người dùng phải có lịch sử xử lý cảnh báo để truy vết.

### 15.4. Quy tắc dữ liệu AI

1. Kết quả AI phải lưu kèm confidence.
2. Có thể lưu ảnh gốc và ảnh annotation tách biệt.
3. Khi AI tắt, hệ thống có thể cho nhập nhãn thủ công nếu cần.
4. Cấu hình AI phải được version hóa hoặc ghi log khi thay đổi.

### 15.5. Quy tắc audit log

1. Các hành động quan trọng phải ghi log: đăng nhập, tạo tài khoản, đổi quyền, xóa dữ liệu, export, sửa cấu hình AI.
2. SuperAdmin phải có quyền xem log toàn hệ thống.
3. Admin có thể xem log trong phạm vi farm nếu được bật quyền.

---

## 16. Kiến trúc hệ thống tổng thể

Kiến trúc hệ thống có thể chia thành 4 lớp chính.

### 16.1. Lớp thu thập dữ liệu

Nguồn dữ liệu gồm:
- camera IP tại chuồng trại,
- webcam,
- ảnh upload từ người dùng,
- dataset public hoặc nội bộ.

### 16.2. Lớp AI perception

Thực hiện:
- phát hiện bò,
- nhận diện lớp hành vi hoặc tư thế,
- tracking ID,
- tạo metadata đầu ra.

Công nghệ đề xuất:
- YOLOv8
- DeepSORT hoặc ByteTrack,
- OpenCV,
- PyTorch / Ultralytics.

### 16.3. Lớp business logic

Bao gồm:
- behavior logic engine,
- cảnh báo,
- điều phối workflow,
- kiểm soát phân quyền,
- audit log,
- xử lý nghiệp vụ multi-tenant.

Công nghệ đề xuất:
- FastAPI,
- service layer Python,
-  PostgreSQL cho production.

### 16.4. Lớp trình bày và tích hợp

- Web frontend,
- Android APK qua Flet nếu cần,
- Telegram Bot / Zalo OA,
- dashboard cho Admin/SuperAdmin/Cục thú y.

---

## 17. Kiến trúc triển khai đề xuất

### 17.1. Edge-first deployment

Phù hợp với môi trường trang trại:

- AI chạy trên máy chủ cục bộ tại farm.
- Camera gửi dữ liệu vào edge server.
- Kết quả được lưu cục bộ.
- Giao diện truy cập qua LAN hoặc đồng bộ lên hệ thống trung tâm khi có mạng.

### 17.2. Hybrid deployment

Kết hợp:

- AI inference tại farm,
- metadata và quản trị tenant trên cloud.

Phù hợp khi muốn:
- SuperAdmin giám sát tập trung,
- đồng bộ báo cáo,
- quản lý nhiều khách hàng.

### 17.3. SaaS deployment

Toàn bộ backend và dashboard chạy tập trung. Edge chỉ làm nhiệm vụ streaming hoặc inference nhẹ. Mô hình này phù hợp khi hạ tầng mạng ổn định.

---

## 18. Thành phần kỹ thuật chính

### 18.1. Frontend

Giao diện web hiện tại thể hiện các khu vực:
- Trang chủ,
- Thu thập ảnh,
- Thư viện,
- Xuất dữ liệu,
- Blog,
- Admin.

Có thể mở rộng thêm:
- SuperAdmin dashboard,
- Cục thú y dashboard,
- Billing / tenant management.

### 18.2. Backend

Các nhóm API cần có:
- auth,
- users,
- farms,
- roles/permissions,
- images,
- cameras,
- AI inference,
- alerts,
- reports,
- export,
- audit logs,
- subscriptions.

### 18.3. Database

Có thể dùng:
- SQLite cho prototype/demo,
- PostgreSQL cho production.

### 18.4. AI engine

- mô hình detection,
- tracking,
- behavior logic,
- batch processing,
- cấu hình threshold.

### 18.5. Notification service

- in-app notification,
- web notification,
- Telegram,
- Zalo OA,
- email/SMS nếu cần.

---

## 19. Quy trình xử lý dữ liệu AI

### 19.1. Quy trình tổng quát

1. Camera hoặc user gửi ảnh/video.
2. Hệ thống nhận input.
3. AI detection phát hiện bò và hành vi cơ bản.
4. Tracking gán ID và nối dữ liệu theo thời gian.
5. Behavior logic engine phân tích chuỗi sự kiện.
6. Nếu có bất thường, hệ thống tạo alert.
7. Kết quả được lưu vào database.
8. Giao diện hiển thị dữ liệu cho đúng vai trò được phép xem.

### 19.2. Dữ liệu đầu vào

- ảnh tĩnh,
- frame video,
- metadata từ camera,
- thông tin người dùng nhập.

### 19.3. Dữ liệu đầu ra

- bounding boxes,
- class label,
- confidence,
- tracking id,
- thời gian phát hiện,
- cảnh báo,
- báo cáo tổng hợp.

---

## 20. Hành vi cần theo dõi

Danh sách hành vi cơ bản hiện tại:

1. Đứng
2. Nằm
3. Ăn
4. Uống
5. Đi lại
6. Bất thường

### 20.1. Hành vi mở rộng có thể phát triển sau

- húc nhau,
- tụ đàn bất thường,
- bò tách đàn,
- giảm hoạt động,
- nằm bệnh,
- mất cân bằng,
- đi khập khiễng.

### 20.2. Nguyên tắc nhận diện

Không phải hành vi nào cũng nhận diện trực tiếp từ 1 frame. Một số hành vi cần kết hợp:

- detection,
- tracking,
- thời gian kéo dài,
- chuyển động,
- tương tác giữa các cá thể,
- ngưỡng logic nghiệp vụ.

---

## 21. Logic phát hiện bất thường

### 21.1. Nằm lâu bất thường

Điều kiện ví dụ:
- cùng 1 tracking ID,
- trạng thái nằm liên tục vượt một ngưỡng thời gian,
- ít thay đổi vị trí,
- không chuyển trạng thái bình thường trong khoảng quan sát.

### 21.2. Húc nhau / va chạm mạnh

Điều kiện ví dụ:
- hai hoặc nhiều bò tiến gần nhanh,
- bounding boxes chồng lấn hoặc tiếp cận đột ngột,
- vector chuyển động đối đầu,
- biên độ thay đổi vị trí lớn trong thời gian ngắn.

### 21.3. Giảm vận động

Điều kiện ví dụ:
- tracking ID xuất hiện lâu,
- quãng đường di chuyển thấp bất thường,
- không thay đổi hành vi trong thời gian dài.

### 21.4. Bỏ ăn / ít tiếp cận máng ăn

Điều kiện ví dụ:
- trong khung giờ ăn,
- bò không xuất hiện gần vùng máng ăn,
- số lần tiếp cận thấp hơn ngưỡng lịch sử.

**Lưu ý:** Đây là logic nghiệp vụ suy luận, cần kiểm định bằng dữ liệu thực tế trước khi dùng làm cảnh báo chính thức ở sản phẩm thương mại.

---

## 22. Chỉ số đánh giá hệ thống

### 22.1. Chỉ số AI

- mAP
- Precision
- Recall
- F1-score
- FPS
- MOTA (nếu dùng tracking)
- ID switch / tracking stability

### 22.2. Chỉ số nghiệp vụ

- số lượng cảnh báo đúng,
- tỷ lệ cảnh báo giả,
- thời gian phản hồi,
- tỷ lệ sự kiện được xử lý,
- thời gian phát hiện trung bình.

### 22.3. Chỉ số sản phẩm

- số farm đang hoạt động,
- số camera đang kết nối,
- số tài khoản active,
- số cảnh báo mỗi ngày,
- tỷ lệ sử dụng tính năng export,
- uptime hệ thống.

---

## 23. Yêu cầu chức năng chi tiết

### 23.1. Quản lý đăng nhập

- Hệ thống phải cho phép người dùng đăng nhập bằng email/username và mật khẩu.
- Hệ thống phải phân quyền sau khi đăng nhập thành công.
- Hệ thống phải chặn truy cập vào module không đủ quyền.
- Hệ thống phải hỗ trợ đăng xuất.

### 23.2. Quản lý người dùng

- Admin phải tạo được User thuộc farm của mình.
- Admin phải sửa, khóa, reset mật khẩu User.
- SuperAdmin phải tạo được Farm và Admin tương ứng.
- SuperAdmin phải khóa/mở tenant hoặc Admin khi cần.

### 23.3. Thu thập ảnh

- Người dùng đủ quyền phải upload được một hoặc nhiều ảnh.
- Hệ thống phải lưu metadata như mã bò, khu vực, thời gian, ghi chú.
- Hệ thống phải hiển thị tiến trình upload.
- Hệ thống phải cho phép chụp từ webcam/camera khi được cấp quyền.

### 23.4. AI xử lý ảnh

- Hệ thống phải gọi mô hình AI để phân tích ảnh khi AI được bật.
- Hệ thống phải trả về kết quả gồm nhãn, confidence, ảnh annotation nếu có.
- Hệ thống phải hỗ trợ chế độ AI tắt và nhập nhãn thủ công nếu cần.

### 23.5. Quản lý thư viện

- Người dùng đủ quyền phải xem được thư viện ảnh của farm mình.
- Hệ thống phải hỗ trợ lọc theo mã bò, hành vi, khu vực và thời gian.
- Người có quyền phải xóa hoặc xem chi tiết ảnh.

### 23.6. Cảnh báo

- Hệ thống phải tạo alert khi phát hiện điều kiện bất thường.
- Hệ thống phải gán mức độ nghiêm trọng cho alert.
- Hệ thống phải gửi alert đến đúng đối tượng.
- Hệ thống phải lưu trạng thái xử lý alert.

### 23.7. Export

- Admin phải xuất được dữ liệu của farm dưới dạng CSV/JSON.
- Cục thú y phải xuất được báo cáo tổng hợp theo phạm vi cho phép.
- SuperAdmin phải xuất được báo cáo hệ thống nếu được cấu hình.

### 23.8. Quản lý AI settings

- Admin phải chỉnh được các tham số như confidence threshold, IOU threshold, max detections trong phạm vi farm.
- Hệ thống phải ghi log khi có thay đổi.
- SuperAdmin phải có quyền ghi đè hoặc kiểm tra cấu hình.

### 23.9. Blog / nội dung

- Người dùng đủ quyền phải tạo và xem bài viết nếu module này được kích hoạt.
- Hệ thống phải hỗ trợ đính kèm ảnh, chỉnh sửa và hiển thị feed.

### 23.10. Quản trị hệ thống

- SuperAdmin phải có dashboard tổng quan toàn nền tảng.
- Hệ thống phải hiển thị số farm, số user, số camera, số alert, trạng thái tenant.
- Hệ thống phải cho phép quản lý vòng đời tenant.

---

## 24. Yêu cầu phi chức năng

### 24.1. Hiệu năng

- Hệ thống cần phản hồi đủ nhanh cho các thao tác web cơ bản.
- AI inference cần đạt tốc độ phù hợp với phần cứng triển khai.
- Dashboard cần tải được dữ liệu mà không gây quá tải.

### 24.2. Sẵn sàng hoạt động

- Ưu tiên hoạt động ổn định ở môi trường trang trại.
- Có cơ chế retry hoặc buffer khi mất mạng.
- Edge deployment cần hoạt động ngay cả khi Internet không ổn định.

### 24.3. Bảo mật

- Xác thực người dùng an toàn.
- Mật khẩu phải được băm.
- Phân quyền chặt chẽ theo vai trò và tenant.
- Ghi log các thao tác quan trọng.
- Giới hạn truy cập theo token/session hợp lệ.

### 24.4. Khả năng mở rộng

- Dễ thêm farm mới.
- Dễ thêm camera mới.
- Dễ thêm vai trò hoặc permission.
- Dễ thay mô hình AI hoặc nâng phiên bản.

### 24.5. Bảo trì

- Cấu trúc module rõ ràng.
- Tách frontend, backend, AI service.
- Có tài liệu API và tài liệu quản trị.

### 24.6. Khả năng kiểm toán

- Có audit log.
- Có lịch sử thay đổi cấu hình.
- Có lịch sử tác động vào cảnh báo và dữ liệu.

---

## 25. Đề xuất mô hình dữ liệu

Dưới đây là các thực thể cốt lõi nên có.

### 25.1. Farm

Chứa thông tin tổ chức/nông trại:
- id
- name
- code
- owner_name
- contact_phone
- address
- region
- status
- subscription_plan
- created_at

### 25.2. User

- id
- farm_id (nullable với SuperAdmin)
- username
- email
- password_hash
- full_name
- role
- status
- last_login_at
- created_at

### 25.3. Permission / Role mapping

Nếu muốn chi tiết hơn RBAC cứng:
- roles
- permissions
- role_permissions
- user_permissions_override

### 25.4. Barn / Area

- id
- farm_id
- name
- code
- description

### 25.5. Camera

- id
- farm_id
- barn_id
- camera_name
- stream_url
- status
- installed_at

### 25.6. Cattle

- id
- farm_id
- cattle_code
- tag_number
- breed
- gender
- birth_date
- health_status

### 25.7. Image / Media

- id
- farm_id
- camera_id
- cattle_id (nullable)
- original_path
- annotated_path
- captured_at
- uploaded_by
- source_type
- notes

### 25.8. Detection Result

- id
- image_id
- model_version
- behavior_label
- confidence
- bbox_x
- bbox_y
- bbox_w
- bbox_h
- tracking_id
- created_at

### 25.9. Alert

- id
- farm_id
- camera_id
- cattle_id (nullable)
- alert_type
- severity
- title
- description
- snapshot_path
- status
- created_at
- acknowledged_by
- resolved_by
- resolved_at

### 25.10. AI Settings

- id
- farm_id
- ai_enabled
- device
- conf_threshold
- iou_threshold
- max_det
- updated_by
- updated_at

### 25.11. Audit Log

- id
- actor_user_id
- farm_id (nullable)
- action
- entity_type
- entity_id
- before_data
- after_data
- ip_address
- created_at

### 25.12. Report / Export History

- id
- farm_id
- export_type
- filters
- file_path
- created_by
- created_at

### 25.13. Subscription / License

- id
- farm_id
- plan_name
- start_date
- end_date
- max_users
- max_cameras
- status

### 25.14. Vet Access Scope

- id
- user_id
- scope_type
- scope_value
- active_from
- active_to

---

## 26. Quan hệ dữ liệu chính

- Một **Farm** có nhiều **User**.
- Một **Farm** có nhiều **Barn**, **Camera**, **Cattle**, **Image**, **Alert**.
- Một **Image** có thể có nhiều **Detection Result**.
- Một **User** có thể tạo nhiều **Image**, xử lý nhiều **Alert**, tạo nhiều **Export**.
- Một **Farm** có một hoặc nhiều bản ghi **AI Settings** theo version hoặc trạng thái hiện tại.
- **Audit Log** liên kết với user thực hiện thao tác.

---

## 27. Định hướng API

### 27.1. Auth APIs

- `POST /auth/login`
- `POST /auth/logout`
- `POST /auth/forgot-password`
- `POST /auth/reset-password`
- `GET /auth/me`

### 27.2. Farm APIs

- `GET /farms`
- `POST /farms`
- `GET /farms/{id}`
- `PATCH /farms/{id}`
- `PATCH /farms/{id}/status`

### 27.3. User APIs

- `GET /users`
- `POST /users`
- `GET /users/{id}`
- `PATCH /users/{id}`
- `PATCH /users/{id}/status`
- `POST /users/{id}/reset-password`

### 27.4. Image APIs

- `POST /images/upload`
- `GET /images`
- `GET /images/{id}`
- `DELETE /images/{id}`

### 27.5. Camera APIs

- `GET /cameras`
- `POST /cameras`
- `PATCH /cameras/{id}`
- `GET /cameras/{id}/stream-status`

### 27.6. Alert APIs

- `GET /alerts`
- `GET /alerts/{id}`
- `PATCH /alerts/{id}/acknowledge`
- `PATCH /alerts/{id}/resolve`

### 27.7. Export APIs

- `GET /exports`
- `POST /exports/csv`
- `POST /exports/json`

### 27.8. AI Settings APIs

- `GET /ai-settings`
- `PATCH /ai-settings`
- `POST /ai-settings/test`

### 27.9. SuperAdmin APIs

- `GET /system/overview`
- `GET /system/audit-logs`
- `GET /system/tenants`
- `PATCH /system/tenants/{id}/status`
- `POST /system/admins`

### 27.10. Vet Authority APIs

- `GET /vet/reports`
- `GET /vet/alerts`
- `GET /vet/farms`

---

## 28. Giao diện người dùng đề xuất

### 28.1. Non User

- Home
- Features
- Articles / Blog
- Demo / CTA
- Login / Register

### 28.2. User dashboard

- Ảnh mới nhất
- Cảnh báo gần đây
- Nút upload/chụp ảnh
- Gallery
- Nhật ký xử lý

### 28.3. Admin dashboard

- Tổng quan farm
- Số camera, số ảnh, số cảnh báo
- Quản lý user
- Cấu hình AI
- Export dữ liệu
- Báo cáo hành vi

### 28.4. SuperAdmin dashboard

- Tổng số farm
- Tổng số user/admin
- Tenant đang active / suspended
- Cảnh báo hệ thống
- Biểu đồ tăng trưởng khách hàng
- Quản lý subscription

### 28.5. Cục thú y dashboard

- Bản đồ/khối khu vực
- Tình hình cảnh báo
- Số farm có dấu hiệu bất thường
- Lọc theo thời gian, khu vực, farm
- Tải báo cáo

---

## 29. Bảo mật và kiểm soát truy cập

### 29.1. Xác thực

- JWT hoặc session-based auth.
- Refresh token nếu hệ thống cần đăng nhập lâu dài.
- Chính sách hết hạn phiên hợp lý.

### 29.2. Phân quyền

- RBAC theo vai trò.
- Kiểm tra `role` và `farm_id` ở mọi API nghiệp vụ.
- Với Cục thú y, cần thêm `scope` chi tiết ngoài role.

### 29.3. Bảo vệ dữ liệu tenant

- Query nào cũng phải lọc theo tenant nếu không phải SuperAdmin.
- Không cho client tự quyết định `farm_id` tùy ý.
- Gắn tenant từ session/token phía server.

### 29.4. Audit và giám sát

- Log hành động quan trọng.
- Cảnh báo hành vi đáng ngờ như export hàng loạt, login thất bại nhiều lần.
- Lưu dấu vết thay đổi cấu hình.

---

## 30. Các rủi ro và thách thức

### 30.1. Rủi ro dữ liệu AI

- Dữ liệu huấn luyện chưa đủ đa dạng.
- Góc camera và ánh sáng ảnh hưởng độ chính xác.
- Hành vi phức tạp khó nhận diện chỉ bằng detection đơn thuần.

### 30.2. Rủi ro hệ thống

- Mất mạng ở trang trại.
- Camera lỗi hoặc stream không ổn định.
- Edge device thiếu tài nguyên.

### 30.3. Rủi ro sản phẩm

- Phân quyền chưa chặt dẫn đến lộ dữ liệu giữa các farm.
- Alert giả quá nhiều khiến người dùng bỏ qua cảnh báo.
- Khó chuẩn hóa quy trình vận hành giữa các khách hàng.

### 30.4. Rủi ro thương mại hóa

- Chưa tách tenant chuẩn từ đầu.
- Chưa có audit log và quản trị subscription.
- Chưa tách rõ quyền Admin và SuperAdmin.

---

## 31. Lộ trình triển khai đề xuất

### Giai đoạn 1: Prototype AI nội bộ

Mục tiêu:
- chạy detection cơ bản,
- tracking,
- giao diện upload/chụp ảnh,
- thư viện ảnh,
- export dataset.

### Giai đoạn 2: Hoàn thiện sản phẩm cho 1 farm

Mục tiêu:
- thêm cảnh báo,
- dashboard,
- AI settings,
- quản lý user cơ bản,
- log vận hành.

### Giai đoạn 3: Multi-tenant thương mại hóa

Mục tiêu:
- thêm farm/tenant,
- tách dữ liệu theo tenant,
- Admin tự tạo User,
- SuperAdmin quản lý tenant,
- subscription và licensing.

### Giai đoạn 4: Dashboard cho Cục thú y

Mục tiêu:
- cấp quyền chuyên môn,
- báo cáo tổng hợp,
- quản lý phạm vi truy cập,
- giám sát theo khu vực.

### Giai đoạn 5: Mở rộng AI nâng cao

Mục tiêu:
- nhận diện hành vi phức tạp,
- dự báo rủi ro,
- phân tích lịch sử,
- học liên tục từ dữ liệu thực tế.

---

## 32. Định hướng công nghệ đề xuất

### 32.1. AI

- Python
- PyTorch
- Ultralytics YOLOv8/v11
- OpenCV
- DeepSORT hoặc ByteTrack

### 32.2. Backend

- FastAPI
- SQLAlchemy hoặc ORM tương đương
- PostgreSQL cho production
- Redis nếu cần queue/cache

### 32.3. Frontend

- HTML/CSS/JS ở prototype
- hoặc React/Vite cho phiên bản sản phẩm chuẩn

### 32.4. Mobile / App

- Flet build APK
- hoặc PWA / responsive web nếu muốn giảm chi phí vận hành

### 32.5. Notification

- Telegram Bot
- Zalo OA
- Email/SMS nếu cần

### 32.6. DevOps

- Docker
- Nginx
- CI/CD cơ bản
- log monitoring

---

## 33. Định hướng module subscription và thương mại hóa

Nếu thương mại hóa, nên chuẩn bị thêm các khái niệm sau:

### 33.1. Gói dịch vụ

Ví dụ:
- Basic
- Standard
- Pro
- Enterprise

### 33.2. Giới hạn theo gói

- số camera tối đa,
- số tài khoản User,
- số ngày lưu dữ liệu,
- có/không có export nâng cao,
- có/không có dashboard cho Cục thú y,
- có/không có cảnh báo đa kênh.

### 33.3. Trạng thái tenant

- trial,
- active,
- suspended,
- expired,
- canceled.

### 33.4. Chính sách vận hành

- chỉ SuperAdmin mới kích hoạt tenant,
- tenant hết hạn có thể bị khóa tính năng,
- dữ liệu có thể được giữ trong thời gian grace period.

---

## 34. Kịch bản sử dụng tiêu biểu

### 34.1. Kịch bản 1: Chủ trại mới đăng ký sử dụng

1. Khách hàng xem landing page.
2. Gửi thông tin liên hệ hoặc đăng ký.
3. SuperAdmin tạo Farm và Admin.
4. Admin đăng nhập lần đầu.
5. Admin tạo User cho nhân viên.
6. Hệ thống bắt đầu vận hành tại farm.

### 34.2. Kịch bản 2: Nhân viên chụp ảnh và lưu vào hệ thống

1. User đăng nhập.
2. Mở tab Thu thập ảnh.
3. Bật camera hoặc upload ảnh.
4. Nhập mã bò, khu vực, ghi chú.
5. Hệ thống lưu ảnh và chạy AI.
6. Kết quả hiển thị và được lưu vào gallery.

### 34.3. Kịch bản 3: Phát hiện bò nằm bất thường

1. Camera gửi dữ liệu liên tục.
2. AI theo dõi một cá thể trong nhiều frame.
3. Behavior engine thấy trạng thái nằm kéo dài.
4. Hệ thống tạo alert mức trung bình/cao.
5. Admin/User nhận thông báo.
6. Người dùng xử lý và cập nhật trạng thái alert.

### 34.4. Kịch bản 4: Admin tạo tài khoản nhân viên

1. Admin vào trang quản lý người dùng.
2. Chọn tạo User mới.
3. Nhập thông tin và vai trò.
4. Hệ thống kiểm tra quota gói dịch vụ.
5. Tạo tài khoản thành công.
6. Audit log ghi lại thao tác.

### 34.5. Kịch bản 5: SuperAdmin giám sát toàn nền tảng

1. SuperAdmin đăng nhập.
2. Xem dashboard tổng quan hệ thống.
3. Kiểm tra tenant nào có cảnh báo nhiều.
4. Xem log thay đổi cấu hình AI của một farm.
5. Hỗ trợ kỹ thuật hoặc khóa tenant nếu có sự cố.

---

## 35. Kết luận

CATTLE ACTION / Con Bò Cười là dự án có tiềm năng cao vì kết hợp được ba lớp giá trị quan trọng:

1. **Giá trị AI thực tiễn:** theo dõi hành vi bò và phát hiện bất thường.
2. **Giá trị dữ liệu:** xây dựng dataset chuẩn phục vụ cải tiến mô hình.
3. **Giá trị sản phẩm thương mại:** triển khai cho nhiều nông trại theo mô hình nhiều cấp quản trị.

Điểm nâng cấp quan trọng nhất của dự án hiện tại là chuyển từ mô hình “một hệ thống nội bộ” sang mô hình **nền tảng đa nông trại có SuperAdmin – Admin – User – Cục thú y – Non User**. Khi làm đúng phần này, hệ thống sẽ có nền tảng tốt để phát triển lâu dài, kiểm soát dữ liệu chặt chẽ và thương mại hóa một cách chuyên nghiệp.

---

## 36. Hướng triển khai tiếp theo được khuyến nghị

Sau tài liệu này, nên tiếp tục xây dựng các tài liệu sau:

1. **Tài liệu Use Case chi tiết** cho từng vai trò.
2. **Tài liệu SRS** gồm functional và non-functional requirements chuẩn hóa hơn.
3. **ERD / Database schema** chi tiết theo multi-tenant.
4. **Phân rã module frontend/backend/AI**.
5. **Roadmap MVP → Pilot → Commercial Release**.
6. **Ma trận quyền RBAC chi tiết ở mức permission**.
7. **Luồng cảnh báo và xử lý sự kiện**.
8. **Thiết kế dashboard cho Admin, SuperAdmin, Cục thú y**.

---

## 37. Phụ lục: Gợi ý chuẩn hóa tên gọi

| Tên hiện tại | Tên chuẩn hóa đề xuất |
|---|---|
| Non User | Guest |
| User | Farm Staff / Employee |
| Admin | Farm Admin |
| Cục thú y | Veterinary Authority |
| SuperAdmin | Platform Super Admin |
| Con Bò Cười | Product Brand Name |
| CATTLE ACTION | Academic / Project Name |

---

## 38. Phụ lục: Tóm tắt ngắn để thuyết trình

**Một câu mô tả dự án:**

> CATTLE ACTION là nền tảng giám sát hành vi và cảnh báo sức khỏe bò bằng AI, cho phép theo dõi đàn bò qua camera, phát hiện bất thường theo thời gian thực, quản lý dữ liệu hành vi và vận hành thương mại hóa cho nhiều nông trại trên cùng một hệ thống.

**Một câu mô tả điểm khác biệt:**

> Dự án không chỉ dừng ở nhận diện hành vi bò, mà còn mở rộng thành nền tảng multi-tenant có phân quyền nhiều cấp gồm SuperAdmin, Admin, User, Cục thú y và khách công khai.

