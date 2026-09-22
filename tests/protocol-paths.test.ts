/**
 * app:// 路径边界测试（P15 任务书二十六）：
 * ../、%2e%2e、嵌套穿越、dist-evil 前缀、绝对路径逃逸、正常文件。
 * 通过旧实现（startsWith 前缀）可穿越的用例在这里必须被新实现（path.relative）拒绝。
 */
import { createRequire } from 'node:module';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const require = createRequire(path.join(process.cwd(), 'package.json'));
const { resolveAppPath } = require(path.join(process.cwd(), 'electron', 'app-path.cjs')) as {
  resolveAppPath: (p: string, distRoot: string) => { ok: true; absolute: string; relative: string } | { ok: false; status: number; reason: string };
};

// 真实 dist 布局之外，额外构造一个兄弟目录场景（与 dist 同级的 dist-evil）
const DIST = path.resolve('/app/dist');

describe('app:// 路径边界（resolveAppPath）', () => {
  it('正常文件：dist 内相对路径放行', () => {
    const r = resolveAppPath('/assets/index.js', DIST);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.absolute).toBe(path.join(DIST, 'assets', 'index.js'));
  });

  it('空路径 → index.html', () => {
    const r = resolveAppPath('/', DIST);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.relative).toBe(path.join('index.html'));
  });

  it('明文 ../ 穿越 → 403', () => {
    const r = resolveAppPath('/../electron/main.cjs', DIST);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(403);
  });

  it('%2e%2e 编码穿越 → 403（解码后仍是 ..）', () => {
    const r = resolveAppPath('/%2e%2e/electron/main.cjs', DIST);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(403);
  });

  it('URL 编码混合大小写 %2E%2E → 403', () => {
    const r = resolveAppPath('/%2E%2E/secrets.txt', DIST);
    expect(r.ok).toBe(false);
  });

  it('%2e%2e%2f 嵌套穿越（../../etc/passwd 全编码）→ 403', () => {
    const r = resolveAppPath('/%2e%2e%2f%2e%2e%2fetc%2fpasswd', DIST);
    expect(r.ok).toBe(false);
  });

  it('嵌套穿越 a/../../x → 403', () => {
    const r = resolveAppPath('/assets/../../electron/main.cjs', DIST);
    expect(r.ok).toBe(false);
  });

  it('尾部 /.. → 403', () => {
    const r = resolveAppPath('/..', DIST);
    expect(r.ok).toBe(false);
  });

  it('dist-evil 兄弟目录前缀穿越（旧 startsWith 实现的真实漏洞）→ 403', () => {
    // 旧实现：resolved = /app/dist-evil/secret.txt，startsWith('/app/dist') === true → 放行！
    const fwd = resolveAppPath('/%2e%2e/dist-evil/secret.txt', DIST);
    expect(fwd.ok, 'dist-evil 穿越未被拒绝（正斜杠形式）').toBe(false);
    // Windows 反斜杠编码形式（%5c = \）
    const bwd = resolveAppPath('/%2e%2e%5cdist-evil%5csecret.txt', DIST);
    expect(bwd.ok, 'dist-evil 穿越未被拒绝（反斜杠形式）').toBe(false);
  });

  it('绝对路径注入（解码后以 / 开头的盘符/UNC）→ 403', () => {
    // 解码后拼进 join：join(dist, '/etc/x') 在 posix 会得到 dist/etc/x（安全），但 Windows 下 'C:\\x' 会替换
    // 两条都构造：相对判定兜底，任何形式都不允许逃出 dist
    expect(resolveAppPath('/..%5C..%5C..%5Cwindows%5Csystem32%5Cconfig%5Csys', DIST).ok).toBe(false);
  });

  it('非法 URL 编码（%zz）→ 400', () => {
    const r = resolveAppPath('/%zz%zz', DIST);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(400);
  });

  it('NUL 字节注入 → 400', () => {
    const r = resolveAppPath('/%00secret', DIST);
    expect(r.ok).toBe(false);
  });

  it('深层正常路径不受影响（assets/ js/ 相对子目录）', () => {
    for (const p of ['/index.html', '/assets/app.js', '/assets/chunks/x-1.js']) {
      expect(resolveAppPath(p, DIST).ok, p).toBe(true);
    }
  });
});
