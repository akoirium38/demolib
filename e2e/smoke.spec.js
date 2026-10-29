import { expect, test } from '@playwright/test';

test('trang chủ hiển thị', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Thư viện DemoLib' })).toBeVisible();
});

test('frontend proxy tới API health', async ({ request }) => {
  const res = await request.get('/api/health');
  expect(res.ok()).toBeTruthy();
  expect(await res.json()).toEqual({ data: { status: 'ok' } });
});
