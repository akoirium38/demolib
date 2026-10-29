# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Tổng quan dự án

Hệ thống quản lý thư viện mượn trả sách (web-based) với 3 vai trò: **Reader**, **Librarian**, **Admin**. Toàn bộ yêu cầu nằm trong `PRD.md` — đây là nguồn sự thật duy nhất về nghiệp vụ, validation rules và thứ tự phụ thuộc giữa các tính năng (PRD Phần 3).

**Tech stack (PRD Phần 4):**
- Frontend: ReactJS, TailwindCSS, Context API, Axios, React Hook Form, Day.js, Recharts
- Backend: Node.js, Express.js (JavaScript), Prisma, Joi, jsonwebtoken (JWT 24h)
- Database: PostgreSQL trên Supabase (cả File Storage)
- Deploy: Vercel; CI/CD: GitHub Actions

## Quy trình làm việc (Waterfall)

Làm tuần tự theo stage, không nhảy stage. Trong Stage 3, làm tính năng theo đúng thứ tự giai đoạn/phụ thuộc trong PRD Phần 3.

### Stage 1 — PRD ✅ (đã xong)
`PRD.md`

### Stage 2 — Thiết kế
1. **Luồng nghiệp vụ:** mỗi chức năng là một file `docs/flows/<mã>-<slug>.md` (ví dụ `docs/flows/2.1.1-dang-ky.md`). Mỗi file gồm:
   - Actor, điều kiện tiên quyết, validation rules (trích từ PRD)
   - Flowchart **Mermaid** (`flowchart TD`) thể hiện cả nhánh thành công và nhánh lỗi
   - **Happy cases** và **Edge cases** đánh số (ví dụ `HC-01`, `EC-01`) — các mã này sẽ được dùng làm test cases ở Stage 3
   - Các API endpoint dự kiến (method, path, request/response, mã lỗi)
2. **Thiết kế DB:** `docs/db-design.md` gồm ERD (Mermaid `erDiagram`), mô tả bảng/cột/kiểu/ràng buộc, enum trạng thái (đơn mượn, yêu cầu trả, phiếu phạt...), index, và các quy tắc toàn vẹn dữ liệu (ví dụ không xóa thể loại khi còn sách).

### Stage 3 — Implement
**Thiết lập (làm một lần):** cài tools/thư viện, cấu hình test framework, viết migration SQL và chạy bằng **Supabase MCP** (`apply_migration`); lưu file SQL trong repo, sau đó đồng bộ Prisma (`prisma db pull` → `prisma generate`). Không chạy `prisma migrate` lên Supabase để tránh lệch lịch sử migration. Kiểm tra lại bằng `list_tables` và `get_advisors` (security/performance) sau mỗi migration.

**Quy trình cho MỖI tính năng:**
1. Tạo nhánh riêng từ `main`: `/git-branch feature/<mã>-<slug>`.
2. Đọc `docs/flows/<mã>-*.md` tương ứng và `docs/db-design.md` trước khi code. Nếu thiết kế cần thay đổi, cập nhật file thiết kế trước rồi mới code.
3. Dùng **Context7 MCP** để tra cú pháp mới nhất của thư viện đang dùng (Express, Prisma, React, Tailwind, Joi, Playwright...).
4. Soạn test cases ở 3 mức, ánh xạ từ HC/EC trong file luồng:
   - **Unit test** — Claude tự viết và tự chạy
   - **API test** — tạo collection/request qua **Postman MCP**, chạy bằng `runCollection`
   - **E2E test** — **Playwright**
5. **Dừng lại, trình bày test cases cho người dùng duyệt.** Chỉ chạy test sau khi được duyệt.
6. Code, chạy test; gặp lỗi thì sửa và chạy lại cho đến khi **pass toàn bộ** 3 mức.
7. Mỗi khi gặp lỗi đáng kể (mất nhiều lần thử, sai cú pháp thư viện, sai thiết kế, lỗi môi trường...), chạy `/learn-by-mistake` để ghi vào `common_errors.md`. Đọc `common_errors.md` trước khi bắt đầu tính năng mới để tránh lặp lỗi.
8. Đánh dấu task hoàn thành trong `plan.md` và cập nhật cột "Trạng thái" trong bảng PRD Phần 3.
9. **Chỉ merge vào `main` (`/merge`) khi test pass hết VÀ người dùng đã kiểm tra, đồng ý.**

### Slash commands của dự án (`.claude/commands/`)
`/git-branch`, `/commit`, `/merge`, `/push`, `/pull`, `/learn-by-mistake`, `/wrap-up` (tổng kết phiên, cập nhật mục "Cấu trúc dự án" bên dưới).

## Kế hoạch & tiến độ

Kế hoạch step-by-step từ Stage 2 trở đi nằm trong `plan.md`. Đọc `plan.md` khi bắt đầu phiên để biết task tiếp theo, và đánh dấu `[x]` ngay khi xong mỗi task.

## Quy tắc nghiệp vụ dễ sai (đọc kỹ PRD khi làm các phần này)

- **Giới hạn mượn 5 cuốn** tính cả đơn "Chờ xác nhận", "Đang mượn", "Quá hạn".
- **Chặn mượn khi còn nợ phạt:** phiếu phạt "Chưa thanh toán", "Chờ xác nhận" hoặc "Từ chối" đều tính là chưa thanh toán.
- **Số lượng sách** chỉ giảm khi nhân viên *xác nhận* đơn mượn, không phải khi độc giả tạo đơn.
- **Trả sách hư hỏng/mất:** sách không quay về kho (tăng bộ đếm hư hỏng/mất); có thể tạo đồng thời phiếu phạt hư hỏng + phiếu phạt trả muộn.
- **Gia hạn:** +7 ngày, tối đa 1 lần, chỉ khi chưa quá hạn. Thời hạn mượn mặc định 14, tối đa 30 ngày.
- Mỗi đơn mượn chỉ có 1 yêu cầu trả ở trạng thái "Chờ xác nhận".
- Xóa thể loại chỉ khi không còn sách; xóa sách chỉ khi không có đơn mượn hoạt động.

## Lệnh thường dùng

Cài đặt lần đầu: `npm i` ở root, `backend/`, `frontend/`; `npx playwright install chromium`; copy `backend/.env.example` → `backend/.env`.

| Việc | Lệnh |
|------|------|
| Backend dev (port 4000, tsx watch) | `cd backend && npm run dev` |
| Frontend dev (port 5173, proxy `/api` → 4000) | `cd frontend && npm run dev` |
| Build FE / lint FE | `cd frontend && npm run build` / `npm run lint` |
| Unit test BE (Vitest + supertest) | `cd backend && npm test` |
| Một file / một test BE | `npx vitest run tests/unit/app.test.js` / `npx vitest run -t "tên test"` |
| Unit test FE (Vitest + Testing Library) | `cd frontend && npm test` |
| E2E toàn bộ (tự bật BE + FE) | `npm run test:e2e` (ở root) |
| Một E2E | `npx playwright test e2e/smoke.spec.js -g "tên test"` |
| Đồng bộ Prisma sau migration | `cd backend && npm run db:pull && npm run db:generate` |
| Seed dữ liệu | `cd backend && npm run db:seed` |
| API test | Postman MCP `runCollection` — workspace `DemoLib` (`faf020ea-6e0d-42c9-9e17-53b80d4f14aa`), env `DemoLib Local` |

Ghi chú kỹ thuật:
- Prisma 7: generator `prisma-client` sinh TypeScript vào `backend/src/generated/prisma` (gitignored) → backend (JS ESM) chạy bằng `tsx`; import `../generated/prisma/client.ts`. Bắt buộc driver adapter `@prisma/adapter-pg`. URL cho CLI nằm trong `backend/prisma.config.js` (`DIRECT_URL`).
- Giữ `prisma` và `@prisma/client` cùng phiên bản chính xác (npm `latest` có lúc trỏ tới bản RC).
- Migration SQL: `backend/sql/NNN_<tên>.sql`, chạy bằng Supabase MCP `apply_migration`.

## Cấu trúc dự án

- `PRD.md` — yêu cầu sản phẩm
- `plan.md` — kế hoạch step-by-step & tiến độ
- `.claude/commands/` — slash commands của dự án
- `.mcp.json` — cấu hình MCP (Supabase)
- `docs/flows/` — (Stage 2) luồng nghiệp vụ theo từng chức năng
- `docs/db-design.md` — (Stage 2) thiết kế DB
- `common_errors.md` — nhật ký lỗi từ `/learn-by-mistake`
