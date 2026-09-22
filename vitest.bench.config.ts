/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';

/** Snapshot benchmark 专用配置（node 环境 + 独立 include，不进默认 npm test） */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['scripts/**/*.bench.ts'],
    testTimeout: 600_000,
  },
});
