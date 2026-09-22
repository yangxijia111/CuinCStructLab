/**
 * Electron 安全配置审计（P14 P0-5）：
 * 静态断言主进程/preload/smoke 的安全红线，防止回归（如再次出现 webSecurity:false）。
 * IPC 参数验证的行为级测试在 gcc-integration.test.ts（validateRunnerPayload 逐字段越界）。
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (p: string): string => readFileSync(resolve(process.cwd(), 'electron', p), 'utf8');

describe('Electron 渲染层安全（main.cjs）', () => {
  const src = read('main.cjs');

  it('webSecurity 与 sandbox 必须开启，禁止关闭', () => {
    expect(src).toContain('sandbox: true');
    expect(src).toContain('webSecurity: true');
    expect(src).not.toContain('webSecurity: false');
    expect(src).not.toContain('sandbox: false');
    expect(src).toContain('contextIsolation: true');
    expect(src).toContain('nodeIntegration: false');
  });

  it('生产加载必须走 app:// 标准协议（file:// 模块加载的安全替代）', () => {
    expect(src).toContain('APP_ENTRY');
    expect(src).not.toContain('loadFile');
  });

  it('禁止渲染层任意打开新窗口（setWindowOpenHandler deny）', () => {
    expect(src).toContain('setWindowOpenHandler');
    expect(src.match(/action:\s*'deny'/)).not.toBeNull();
  });

  it('导航限制：仅允许应用自身与本机开发服务器', () => {
    expect(src).toContain('will-navigate');
    expect(src).toContain('DEV_URL_ALLOW');
  });

  it('IPC 参数验证存在：db:save 大小上限 + runner payload 验证', () => {
    expect(src).toContain('MAX_DB_BYTES');
    expect(src).toContain('instanceof Uint8Array');
    expect(src).toContain('validateRunnerPayload');
  });

  it('Runner 逻辑不得内联在 IPC 层（单一实现原则）', () => {
    expect(src).toContain("require('./runner-core.cjs')");
    expect(src).not.toContain("require('node:crypto')");
  });
});

describe('preload 最小暴露（preload.cjs）', () => {
  it('仅暴露白名单桥接函数', () => {
    const src = read('preload.cjs');
    const allowed = ['isDesktop', 'dbLoad', 'dbSave', 'dbReset', 'runnerDetect', 'runnerCompileAndRun', 'chooseCompilerPath'];
    for (const key of allowed) {
      expect(src).toContain(key);
    }
    // 不得暴露任何超出白名单的能力
    expect(src).not.toMatch(/require\(['"](?!(electron)['"])/);
    expect(src).not.toContain('nodeIntegration');
    expect(src).not.toContain('process.');
  });
});

describe('app:// 协议（protocol.cjs）', () => {
  it('必须包含路径穿越防护（P15：path.relative 判定，禁止弱化的字符串前缀判断）', () => {
    const src = read('protocol.cjs');
    const appPath = read('app-path.cjs');
    // P15 修复：startsWith(DIST_ROOT) 前缀判断允许兄弟目录 dist-evil 穿越，已替换为 path.relative
    expect(src).not.toContain('startsWith(DIST_ROOT)');
    expect(src).toContain('resolveAppPath');
    expect(appPath).toContain("startsWith('..')");
    expect(appPath).toContain('path.isAbsolute');
    expect(appPath).toContain('decodeURIComponent');
  });

  it('注册为标准 + 安全协议', () => {
    const src = read('protocol.cjs');
    expect(src).toContain('standard: true');
    expect(src).toContain('secure: true');
    expect(src).toContain('Content-Security-Policy');
  });
});

describe('smoke 与生产同安全配置（smoke.cjs）', () => {
  it('冒烟测试不得使用降级安全配置', () => {
    const src = read('smoke.cjs');
    expect(src).toContain('sandbox: true');
    expect(src).toContain('webSecurity: true');
    expect(src).not.toContain('webSecurity: false');
  });
});
