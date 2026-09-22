/**
 * app:// 路径解析纯函数（无 electron 依赖，可单测；protocol.cjs 调用）。
 * 边界规则（P15 任务书二十六）：
 *   - 字符串前缀判断不等价于目录边界：用 path.relative 判定
 *   - 拒绝 relative 以 '..' 开头或为绝对路径（盘符逃逸/UNC）
 *   - URL decode 异常（%zz）→ 400
 */
'use strict';
const path = require('node:path');

/**
 * @param {string} rawPathname URL pathname（未解码）
 * @param {string} distRoot dist 绝对路径
 * @returns {{ ok: true, absolute: string, relative: string } | { ok: false, status: number, reason: string }}
 */
function resolveAppPath(rawPathname, distRoot) {
  if (typeof rawPathname !== 'string') {
    return { ok: false, status: 400, reason: 'pathname 必须是字符串' };
  }
  let decoded;
  try {
    decoded = decodeURIComponent(rawPathname);
  } catch {
    return { ok: false, status: 400, reason: 'URL 编码非法' };
  }
  // 去除 NUL 等控制字符（Windows 路径保留字符防御）
  if (decoded.includes('\0')) {
    return { ok: false, status: 400, reason: '路径含非法字符' };
  }
  let rel = decoded.replace(/^\/+/, '');
  if (rel === '') rel = 'index.html';
  const resolved = path.normalize(path.join(distRoot, rel));
  const relative = path.relative(distRoot, resolved);
  if (relative === '' || relative.startsWith('..') || path.isAbsolute(relative)) {
    return { ok: false, status: 403, reason: `路径越界: ${decoded}` };
  }
  return { ok: true, absolute: resolved, relative };
}

module.exports = { resolveAppPath };
