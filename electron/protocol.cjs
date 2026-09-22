/**
 * app:// 自定义协议（Electron 官方推荐做法）：
 * 生产构建以标准协议加载 dist/，使 ES modules 与相对 base 在 webSecurity: true 下正常工作，
 * 无需关闭同源限制。dev 模式仍直连 Vite dev server。
 *
 * 路径边界：resolveAppPath（app-path.cjs）——path.relative 判定，
 * 拒绝 '../'、'%2e%2e' 编码穿越、兄弟目录前缀（dist-evil）与绝对路径逃逸。
 */
'use strict';
const { protocol, net } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { resolveAppPath } = require('./app-path.cjs');

const DIST_ROOT = path.join(__dirname, '..', 'dist');
const APP_ORIGIN = 'app://bundle';
const APP_ENTRY = 'app://bundle/index.html';

/** 必须在 app ready 之前调用 */
function registerAppProtocolScheme() {
  protocol.registerSchemesAsPrivileged([
    { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } },
  ]);
}

/** app ready 之后调用 */
function attachAppProtocolHandler() {
  protocol.handle('app', async (request) => {
    const url = new URL(request.url);
    const resolved = resolveAppPath(url.pathname, DIST_ROOT);
    if (!resolved.ok) {
      return new Response('forbidden', { status: resolved.status });
    }
    try {
      const res = await net.fetch(pathToFileURL(resolved.absolute).toString());
      const headers = new Headers(res.headers);
      // 渲染层 CSP（app:// 下 'self' 即 app://bundle）
      headers.set(
        'Content-Security-Policy',
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'",
      );
      return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
    } catch {
      return new Response('not found', { status: 404 });
    }
  });
}

module.exports = { registerAppProtocolScheme, attachAppProtocolHandler, APP_ORIGIN, APP_ENTRY, DIST_ROOT };
