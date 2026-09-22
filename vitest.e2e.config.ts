/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';

/**
 * Electron E2E 专用配置（与单元测试隔离；不进默认 npm test）：
 *   - node 环境（playwright _electron 控制真实 Electron 进程）
 *   - singleFork 串行（Electron 实例与 userData 目录独占）
 *   - 生产 dist 构建前置（app:// 协议加载）
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/e2e/**/*.e2e.ts'],
    setupFiles: ['./tests/e2e/setup.ts'],
    testTimeout: 180_000,
    hookTimeout: 180_000,
    fileParallelism: false,
  },
});
