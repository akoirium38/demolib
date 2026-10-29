# Kế hoạch & tiến độ

Đánh dấu `[x]` ngay khi xong mỗi task.

### Stage 2 — Thiết kế
- [x] 2.0 Tạo thư mục `docs/flows/` và template chung cho file luồng
- [x] 2.1 Luồng: 2.1.1 Đăng ký
- [x] 2.2 Luồng: 2.1.2 Đăng nhập
- [x] 2.3 Luồng: 2.1.3 Hồ sơ cá nhân
- [x] 2.4 Luồng: 2.2.1 Quản lý thể loại sách
- [x] 2.5 Luồng: 2.2.2 Thêm sách mới
- [x] 2.6 Luồng: 2.2.3 Xem danh sách sách
- [x] 2.7 Luồng: 2.2.4 Xem chi tiết sách
- [x] 2.8 Luồng: 2.2.5 Sửa & xóa sách
- [x] 2.9 Luồng: 2.3.1 Mượn sách (Độc giả)
- [x] 2.10 Luồng: 2.3.2 Mượn sách (Nhân viên — xác nhận/từ chối)
- [x] 2.11 Luồng: 2.3.3 Lịch sử mượn & gia hạn
- [x] 2.12 Luồng: 2.4.1 Yêu cầu trả sách
- [x] 2.13 Luồng: 2.4.2 Xác nhận trả sách (bình thường/hư hỏng/mất, trả muộn)
- [x] 2.14 Luồng: 2.5.1 Quản lý mức phạt
- [x] 2.15 Luồng: 2.5.2 Thanh toán phạt (Độc giả)
- [x] 2.16 Luồng: 2.5.3 Xác nhận thanh toán phạt (Nhân viên)
- [x] 2.17 Luồng: 2.6.1 Danh sách người dùng
- [x] 2.18 Luồng: 2.6.2 Gán vai trò
- [x] 2.19 Luồng: 2.7.1 Dashboard
- [x] 2.20 Luồng: 2.7.2 Báo cáo chi tiết (CSV, lọc thời gian)
- [x] 2.21 Thiết kế DB `docs/db-design.md` (ERD, bảng, enum trạng thái, index, ràng buộc)
- [x] 2.22 Rà soát chéo luồng ↔ DB, người dùng duyệt thiết kế

### Stage 3 — Implement
**Thiết lập**
- [x] 3.0.1 `git init`, tạo nhánh `main`, `.gitignore`, `.env.example`
- [x] 3.0.2 Khởi tạo backend (Express, Prisma, Joi, JWT) + unit test framework
- [x] 3.0.3 Khởi tạo frontend (React, Tailwind, Axios, React Hook Form, Day.js, Recharts)
- [x] 3.0.4 Cài đặt & cấu hình Playwright
- [x] 3.0.5 Tạo workspace/environment Postman qua Postman MCP
- [x] 3.0.6 Viết migration SQL theo `docs/db-design.md`, chạy bằng Supabase MCP, đồng bộ Prisma, seed dữ liệu (tài khoản Admin/Librarian, thể loại mẫu)
- [x] 3.0.7 Cập nhật mục "Lệnh thường dùng" trong `CLAUDE.md`

**Tính năng** (mỗi dòng = 1 nhánh, đủ các bước 1–9 ở trên)
- [x] 3.1 2.1.1 Đăng ký
- [x] 3.2 2.1.2 Đăng nhập
- [x] 3.3 2.1.3 Hồ sơ cá nhân
- [ ] 3.4 2.2.1 Quản lý thể loại sách
- [ ] 3.5 2.2.2 Thêm sách mới
- [ ] 3.6 2.2.3 Xem danh sách sách
- [ ] 3.7 2.2.4 Xem chi tiết sách
- [ ] 3.8 2.2.5 Sửa & xóa sách
- [ ] 3.9 2.3.1 Mượn sách (Độc giả)
- [ ] 3.10 2.3.2 Mượn sách (Nhân viên)
- [ ] 3.11 2.3.3 Lịch sử mượn & gia hạn
- [ ] 3.12 2.4.1 Yêu cầu trả sách
- [ ] 3.13 2.4.2 Xác nhận trả sách
- [ ] 3.14 2.5.1 Quản lý mức phạt
- [ ] 3.15 2.5.2 Thanh toán phạt (Độc giả)
- [ ] 3.16 2.5.3 Xác nhận thanh toán phạt (Nhân viên)
- [ ] 3.17 2.6.1 Danh sách người dùng
- [ ] 3.18 2.6.2 Gán vai trò
- [ ] 3.19 2.7.1 Dashboard
- [ ] 3.20 2.7.2 Báo cáo chi tiết

