# Nhật ký lỗi thường gặp

Ghi bởi `/learn-by-mistake`. Đọc trước khi bắt đầu tính năng mới.

## Test framework (Vitest / Testing Library)

### Testing Library không tự dọn DOM giữa các test (3.2 — 2.1.2 Đăng nhập)
- **Triệu chứng:** từ test FE thứ 2 trở đi, DOM của test trước vẫn còn → query tìm thấy phần tử trùng / sai kết quả.
- **Nguyên nhân:** auto-cleanup của Testing Library chỉ chạy khi có `afterEach` toàn cục; Vitest không bật `globals` nên không có.
- **Cách sửa:** thêm `afterEach(cleanup)` (import từ `vitest` và `@testing-library/react`) vào `frontend/src/test/setup.js`.

## Thư viện (Prisma)

### Prisma `contains` không escape ký tự đại diện LIKE (3.6 — 2.2.3 Danh sách sách)
- **Triệu chứng:** tìm `q=%` trả về mọi sách; `_` khớp một ký tự bất kỳ.
- **Nguyên nhân:** `contains` (kể cả `mode: 'insensitive'` → ILIKE) chèn chuỗi thẳng vào `%…%`, không escape `%`, `_`, `\`.
- **Cách sửa:** tự escape trước khi truy vấn: ``value.replace(/[\\%_]/g, (c) => `\\${c}`)`` (backslash là ký tự escape mặc định của LIKE trong PostgreSQL). Kiểm chứng trên DB thật, không chỉ unit test với mock.

## API test (Postman MCP)

### Cloudflare của Postman chặn collection chứa chuỗi giống SQL injection (3.6)
- **Triệu chứng:** `createCollection` trả `403 … Sorry, you have been blocked` (trang Cloudflare).
- **Nguyên nhân:** request mẫu có `'; DROP TABLE books;--` → WAF của postman.com chặn payload.
- **Cách sửa:** test dấu nháy bằng giá trị vô hại (`O'Reilly`); kiểm tra SQL injection ở unit test thay vì đưa chuỗi tấn công vào Postman.

### `runCollection` chỉ đọc shared value của environment (3.2 — 2.1.2 Đăng nhập)
- **Triệu chứng:** collection "2.1.2 Đăng nhập" chỉ pass 12/26; các request đăng nhập trả 400 vì `{{seedPassword}}` rỗng, dù đã điền trong Postman app.
- **Nguyên nhân:** `runCollection` chạy trên cloud, chỉ dùng **shared / initial value**; *current value* chỉ lưu cục bộ trong app.
- **Cách sửa:** điền giá trị vào cột **Shared / Initial value** rồi **Ctrl+S**, hoặc set bằng Postman MCP `putEnvironment` (gửi lại đủ mọi biến vì API thay thế toàn bộ). Kiểm tra bằng `getEnvironment` trước khi chạy lại.

### Biến environment che biến collection cùng tên (3.4 — 2.2.1 Thể loại)
- **Triệu chứng:** request dùng `{{readerToken}}` / `{{adminToken}}` nhận 401 thay vì 403/201 (7/38 fail), trong khi `{{staffToken}}` vẫn chạy đúng.
- **Nguyên nhân:** script lưu token bằng `pm.collectionVariables.set`, nhưng env **DemoLib Local** đã có sẵn biến `readerToken`, `adminToken` (rỗng). Environment được ưu tiên hơn collection variable → `{{readerToken}}` ra chuỗi rỗng.
- **Cách sửa:** biến nào đã có trong env (`readerToken`, `librarianToken`, `adminToken`, `seedPassword`, `baseUrl`) thì ghi bằng `pm.environment.set`; biến riêng của collection thì đặt tên không trùng env.

### Script Postman dùng `Intl` với `timeZone` ra giá trị rỗng (3.5 — 2.2.2 Thêm sách)
- **Triệu chứng:** A-05b (năm hiện tại) nhận 400 do body có `"publishYear":,` (JSON hỏng); A-08b (năm sau) vẫn "pass" vì `Number('') + 1 = 1` cũng bị 400.
- **Nguyên nhân:** `new Intl.DateTimeFormat('en', { timeZone: 'Asia/Ho_Chi_Minh', ... })` không chạy được trong sandbox `runCollection` → `{{currentYear}}` rỗng.
- **Cách sửa:** tính giờ VN bằng offset cố định: `new Date(Date.now() + 7 * 3600 * 1000).getUTCFullYear()`; thêm assertion kiểm tra biến sinh ra hợp lệ để test không pass nhầm.

## Công cụ / môi trường

### Heredoc trong Git Bash làm mất dấu `\` khi ghi code (3.6)
- **Triệu chứng:** regex `/[\\%_]/` ghi ra file thành `/[\%_]/`, template `` `\\${c}` `` thành `` `\${c}` `` → unit test escape fail.
- **Cách sửa:** code có backslash thì dùng tool Edit/Write, không `cat <<EOF`/python qua Bash; luôn có unit test bao phủ chuỗi escape.

### Prettier mặc định khác style dự án (3.6)
- **Triệu chứng:** `npx prettier --write` đổi sang nháy kép + dấu `;` (FE dự án dùng nháy đơn, không `;`, rộng 120).
- **Cách sửa:** FE: `npx prettier --single-quote --no-semi --print-width 120`; repo chưa có `.prettierrc`.

## Môi trường E2E

### Timeout một lần ngay sau khi đổi nhánh (3.4)
- **Triệu chứng:** một test E2E chờ `getByLabel('Email')` ở `/login` quá 30s ở lần chạy đầu sau `git checkout`; 2 lần chạy lại đều pass 29/29.
- **Nguyên nhân (nghi ngờ):** Playwright dùng lại dev server đang chạy (`reuseExistingServer`), lần tải đầu sau khi đổi nhánh Vite/tsx đang biên dịch lại.
- **Cách xử lý:** chạy lại để xác nhận trước khi sửa code; nếu lặp lại thì tắt dev server cũ để Playwright tự khởi động.
