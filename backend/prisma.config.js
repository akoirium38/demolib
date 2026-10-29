import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

// CLI (db pull) dùng kết nối trực tiếp; runtime dùng DATABASE_URL (pooler) qua adapter-pg.
// Không dùng `prisma migrate` — migration là SQL thuần trong sql/, chạy qua Supabase MCP.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: env('DIRECT_URL'),
  },
});
