import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/smoke',
  timeout: 90_000,
  workers: 1,
  reporter: 'list',
  projects: [{ name: 'development' }, { name: 'packaged' }],
});
