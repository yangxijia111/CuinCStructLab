/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/** 生产构建向 index.html 注入 CSP meta（app:// 桌面端另有响应头 CSP；本插件保障 Web 部署） */
function cspInject(): Plugin {
  return {
    name: 'csp-inject',
    apply: 'build',
    transformIndexHtml(html) {
      const csp = [
        "default-src 'self' file:",
        "script-src 'self' file:",
        "style-src 'self' file: 'unsafe-inline'",
        "img-src 'self' file: data:",
        "font-src 'self' file: data:",
        "connect-src 'self' file:",
        "object-src 'none'",
        "base-uri 'none'",
        "form-action 'none'",
      ].join('; ');
      return html.replace('</title>', `</title>\n    <meta http-equiv="Content-Security-Policy" content="${csp}">`);
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [react(), cspInject()],
  build: {
    chunkSizeWarningLimit: 1600,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'tests/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      include: ['src/core/**', 'src/storage/**', 'src/exercises/**', 'src/judge/**'],
      thresholds: {
        statements: 85,
        branches: 80,
        functions: 85,
        lines: 85,
      },
    },
  },
});
