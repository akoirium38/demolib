# Nhật ký lỗi thường gặp

Ghi bởi `/learn-by-mistake`. Đọc trước khi bắt đầu tính năng mới.

## Test framework (Vitest / Testing Library)

### Testing Library không tự dọn DOM giữa các test (3.2 — 2.1.2 Đăng nhập)
- **Triệu chứng:** từ test FE thứ 2 trở đi, DOM của test trước vẫn còn → query tìm thấy phần tử trùng / sai kết quả.
- **Nguyên nhân:** auto-cleanup của Testing Library chỉ chạy khi có `afterEach` toàn cục; Vitest không bật `globals` nên không có.
- **Cách sửa:** thêm `afterEach(cleanup)` (import từ `vitest` và `@testing-library/react`) vào `frontend/src/test/setup.js`.

## API test (Postman MCP)

### `runCollection` chỉ đọc shared value của environment (3.2 — 2.1.2 Đăng nhập)
- **Triệu chứng:** collection "2.1.2 Đăng nhập" chỉ pass 12/26; các request đăng nhập trả 400 vì `{{seedPassword}}` rỗng, dù đã điền trong Postman app.
- **Nguyên nhân:** `runCollection` chạy trên cloud, chỉ dùng **shared / initial value**; *current value* chỉ lưu cục bộ trong app.
- **Cách sửa:** điền giá trị vào cột **Shared / Initial value** rồi **Ctrl+S**, hoặc set bằng Postman MCP `putEnvironment` (gửi lại đủ mọi biến vì API thay thế toàn bộ). Kiểm tra bằng `getEnvironment` trước khi chạy lại.
