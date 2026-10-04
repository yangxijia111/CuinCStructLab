/**
 * 开发服务器 URL 判定（独立纯函数模块，供 main.cjs 与安全测试共用）。
 * 必须解析 URL 后看 hostname：字符串正则会把 `http://127.0.0.1:5173@evil.com/`
 * 里的 userinfo 误当 host，从而放行任意远程站点（preload 桥随窗口逃逸）。
 */
'use strict';

/** 开发服务器仅允许本机回环地址（http + localhost/127.0.0.1/[::1]，无 userinfo） */
function isDevUrl(url) {
  try {
    const u = new URL(url);
    return (
      u.protocol === 'http:' &&
      (u.hostname === 'localhost' || u.hostname === '127.0.0.1' || u.hostname === '[::1]') &&
      u.username === '' &&
      u.password === ''
    );
  } catch {
    return false;
  }
}

module.exports = { isDevUrl };
