import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './specs',
  workers: 1,
  fullyParallel: false,
  reporter: 'list',
});
