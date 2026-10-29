import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Sau khi chạy E2E: xóa dữ liệu test (sách/thể loại "E2E ...", tài khoản @test.demolib.local)
export default function globalTeardown() {
  execSync('npm run db:cleanup-test', {
    cwd: fileURLToPath(new URL('../backend', import.meta.url)),
    stdio: 'inherit',
  });
}
