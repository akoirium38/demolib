import { defineConfig, devices } from '@playwright/test';

const reuse = !process.env.CI;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    locale: 'vi-VN',
    timezoneId: 'Asia/Ho_Chi_Minh',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      name: 'Backend',
      command: 'npm run dev',
      cwd: './backend',
      url: 'http://localhost:4000/api/health',
      reuseExistingServer: reuse,
      timeout: 60_000,
    },
    {
      name: 'Frontend',
      command: 'npm run dev',
      cwd: './frontend',
      url: 'http://localhost:5173',
      reuseExistingServer: reuse,
      timeout: 60_000,
    },
  ],
});
