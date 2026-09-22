/**
 * Electron E2E（P15 任务书二十四/二十五）：真用户流程，非截图测试。
 * 场景：1 启动→首页；2 课程进度持久化（重启后仍 done）；3 实验室单链表回放
 *      （Next/Previous/Jump 终态正确）；4 referenceSolution 判题 Accepted；
 *      5 错误代码 Wrong Answer；6 导出→清空→导入恢复。
 *
 * 运行前提：npm run build（dist 存在）；判题场景需要真实 C 编译器
 * （CCLAB_E2E_HAS_COMPILER=1 时执行，否则显式跳过——CI 强制执行）。
 */
import { existsSync } from 'node:fs';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { _electron, type ElectronApplication, type Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const DIST_INDEX = path.join(process.cwd(), 'dist', 'index.html');
const HAS_COMPILER = process.env.CCLAB_E2E_HAS_COMPILER === '1';

let app: ElectronApplication | null = null;
let page: Page | null = null;
let userDataDir = '';

async function launchApp(): Promise<{ app: ElectronApplication; page: Page }> {
  const a = await _electron.launch({
    args: [path.join(process.cwd(), 'electron', 'main.cjs'), `--user-data-dir=${userDataDir}`],
    env: { ...process.env, ELECTRON_DISABLE_SANDBOX: '1' },
  });
  await a.context().grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => undefined);
  const p = await a.firstWindow();
  p.setDefaultTimeout(30_000);
  return { app: a, page: p };
}

async function closeApp(): Promise<void> {
  if (app !== null) {
    await app.close().catch(() => undefined);
    app = null;
    page = null;
  }
}

/** 通过 hash 路由或侧栏导航进入页面 */
async function goto(page: Page, hash: string): Promise<void> {
  await page.evaluate((h) => {
    window.location.hash = h;
  }, hash);
  await page.waitForTimeout(800); // 路由 + 数据恢复
}

/** 翻到章节最后一节（"完成本章"按钮只在最后一节渲染） */
async function gotoLastSection(p: Page): Promise<void> {
  const doneBtn = p.getByRole('button', { name: /完成本章|已完成本章/ }).first();
  for (let i = 0; i < 30; i++) {
    if (await doneBtn.isVisible().catch(() => false)) return;
    const next = p.getByRole('button', { name: /下一节 →/ }).first();
    const disabled = await next.isDisabled().catch(() => true);
    if (disabled) return;
    await next.click();
    await p.waitForTimeout(150);
  }
}

beforeAll(async () => {
  if (!existsSync(DIST_INDEX)) {
    throw new Error('dist/index.html 不存在：E2E 需要先 npm run build（生产 app:// 加载）');
  }
  userDataDir = await mkdtemp(path.join(tmpdir(), 'cclab-e2e-'));
  const launched = await launchApp();
  app = launched.app;
  page = launched.page;
});

afterAll(async () => {
  await closeApp();
  if (userDataDir !== '') await rm(userDataDir, { recursive: true, force: true }).catch(() => undefined);
});

describe('场景 1：启动 App → 首页', () => {
  it('生产模式经 app:// 加载首页并渲染导航', async () => {
    expect(page).not.toBeNull();
    await page!.waitForURL(/app:\/\//);
    // 首页渲染：存在应用主体（侧栏或主内容）
    const body = await page!.textContent('body');
    expect(body).toBeTruthy();
    expect(body!.length).toBeGreaterThan(50);
  });
});

describe('场景 2：课程 → 章节切换 → 标记完成 → 重启 → 仍 done', () => {
  it('标记章节完成后重启应用，进度持久', async () => {
    await goto(page!, '#/course/1');
    // 章节页：连续"下一节"翻到最后一节，出现"完成本章"按钮
    const doneBtn = page!.getByRole('button', { name: /^完成本章$/ }).first();
    for (let i = 0; i < 30; i++) {
      if (await doneBtn.isVisible().catch(() => false)) break;
      const next = page!.getByRole('button', { name: /下一节 →/ }).first();
      const disabled = await next.isDisabled().catch(() => true);
      if (disabled) break;
      await next.click();
      await page!.waitForTimeout(150);
    }
    await doneBtn.waitFor({ state: 'visible', timeout: 30_000 });
    await doneBtn.click();
    // 按钮切换为已完成状态
    await (page!.getByRole('button', { name: /已完成本章/ }).first()).waitFor({ state: 'visible', timeout: 30_000 });

    // 重启（同一 userData）
    await closeApp();
    const relaunched = await launchApp();
    app = relaunched.app;
    page = relaunched.page;
    await page.waitForURL(/app:\/\//);
    await goto(page!, '#/course/1');
    // 重启后仍 done：最后一节的按钮直接是已完成
    const doneBtn2 = page!.getByRole('button', { name: /已完成本章/ }).first();
    for (let i = 0; i < 30; i++) {
      if (await doneBtn2.isVisible().catch(() => false)) break;
      const next = page!.getByRole('button', { name: /下一节 →/ }).first();
      const disabled = await next.isDisabled().catch(() => true);
      if (disabled) break;
      await next.click();
      await page!.waitForTimeout(150);
    }
    await doneBtn2.waitFor({ state: 'visible', timeout: 30_000 });
  });
});

describe('场景 3：实验室单链表 10 20 30 → insertAt(1,15) → 回放控制 → 终态正确', () => {
  it('Next/Previous/Jump 后链表显示 10 15 20 30', async () => {
    await goto(page!, '#/lab');
    // 切到单链表
    await page!.getByRole('tab', { name: '单链表' }).click();
    // 初始数据 10 20 30
    await page!.fill('#lab-init-input', '10 20 30');
    await page!.getByRole('button', { name: '初始化' }).click();
    // insertAt(pos=1, value=15)
    const insertBlock = page!.locator('.lab-op', { hasText: '指定位置插入' }).first();
    await insertBlock.locator('label:has-text("位置") input').fill('1');
    await insertBlock.locator('label:has-text("值") input').fill('15');
    await insertBlock.getByRole('button').click();
    // 出现回放器（步骤已生成）
    await page!.locator('.playback-bar').waitFor({ state: 'visible', timeout: 30_000 });
    // Next：单步到末尾（走完 insert 全部步骤）
    const next = page!.getByRole('button', { name: '下一步' });
    for (let i = 0; i < 30; i++) {
      const disabled = await next.isDisabled().catch(() => true);
      if (disabled) break;
      await next.click();
      await page!.waitForTimeout(30);
    }
    // Previous：回退一步再前进
    const prev = page!.getByRole('button', { name: '上一步' });
    const prevDisabled = await prev.isDisabled().catch(() => true);
    if (!prevDisabled) {
      await prev.click();
      await page!.waitForTimeout(50);
      await next.click();
      await page!.waitForTimeout(50);
    }
    // Jump：跳到最后一步（跳转输入：aria-label 跳转到指定步）
    const jump = page!.locator('input[aria-label="跳转到指定步"]');
    if (await jump.count()) {
      const max = await jump.getAttribute('max');
      if (max !== null) {
        await jump.fill(max);
        await jump.press('Enter');
        await page!.waitForTimeout(100);
      }
    }
    // 终态：链表值序列 10 15 20 30（StateRenderer 渲染节点值）
    const text = await page!.locator('.lab-main').textContent();
    expect(text).toContain('10');
    expect(text).toContain('15');
    expect(text).toContain('20');
    expect(text).toContain('30');
    // 顺序断言：15 位于 10 之后、20 之前
    const idx10 = text!.indexOf('10');
    const idx15 = text!.indexOf('15');
    const idx20 = text!.indexOf('20');
    const idx30 = text!.indexOf('30');
    expect(idx10).toBeGreaterThanOrEqual(0);
    expect(idx15).toBeGreaterThan(idx10);
    expect(idx20).toBeGreaterThan(idx15);
    expect(idx30).toBeGreaterThan(idx20);
  });
});

describe.skipIf(!HAS_COMPILER)('场景 4：代码练习 → referenceSolution 判题 Accepted', () => {
  it('输入参考答案并判题通过', async () => {
    await goto(page!, '#/coding');
    // 选择第一道题
    await page!.locator('.coding-item').first().click();
    await page!.waitForTimeout(600);
    // 通过 React 状态接口不好直接注入 CodeMirror：用编辑器 DOM 输入参考答案
    // CodeMirror 6 contenteditable：全选后键入
    const editor = page!.locator('.cm-content').first();
    await editor.click();
    await page!.keyboard.press('Control+a');
    await page!.keyboard.press('Delete');
    // 从 window 读取参考答案（应用已加载 problems）不可行——直接用页面"参考答案"面板展示值？
    // 更稳：把参考答案文本写入剪贴板再粘贴。此处用 CDP 不便，改为键盘输入太长。
    // 方案：通过 evaluate 调用 cm 实例不可达 → 使用页面内数据：CODING_PROBLEMS 已打包进 bundle，
    // 通过 React props 无法直接读。退而求其次：点击"显示参考答案"后复制其文本，再清空编辑器粘贴。
    await page!.getByRole('button', { name: /参考答案/ }).click();
    const refText = (await page!.locator('.pw-reference').first().textContent()) ?? '';
    expect(refText.length).toBeGreaterThan(20);
    await editor.click();
    await page!.keyboard.press('Control+a');
    await page!.evaluate((t) => navigator.clipboard.writeText(t), refText);
    await page!.keyboard.press('Control+v');
    await page!.waitForTimeout(400);
    // 判题
    await page!.getByRole('button', { name: /运行判题/ }).click();
    // 结果 Accepted
    await (page!.getByText('Accepted').first()).waitFor({ state: 'visible', timeout: 120_000 });
  });
});

describe.skipIf(!HAS_COMPILER)('场景 5：错误代码 → Wrong Answer', () => {
  it('提交错误实现被判 Wrong Answer', async () => {
    await goto(page!, '#/coding');
    await page!.locator('.coding-item').first().click();
    await page!.waitForTimeout(600);
    const editor = page!.locator('.cm-content').first();
    await editor.click();
    await page!.keyboard.press('Control+a');
    // 输入可编译但错误的代码：return -1 的恒失败实现（对 p-seqlist-insert 任何用例都不产出输出）
    const wrong = '#include <stdio.h>\nint seqListInsert(int *a, int *n, int pos, int v) { (void)a;(void)n;(void)pos;(void)v; return -1; }\n';
    await page!.evaluate((t) => navigator.clipboard.writeText(t), wrong);
    await page!.keyboard.press('Control+v');
    await page!.waitForTimeout(400);
    await page!.getByRole('button', { name: /运行判题/ }).click();
    await (page!.getByText('Wrong Answer').first()).waitFor({ state: 'visible', timeout: 120_000 });
  });
});

describe('场景 6：导出 → 清空 → 导入 → 数据恢复', () => {
  it('进度数据经导出/清空/导入后恢复', async () => {
    // 前置：场景 2 已完成章节 1（同一 userData）
    await goto(page!, '#/settings');
    await page!.getByRole('button', { name: /导出全部数据/ }).waitFor({ state: 'visible', timeout: 30_000 });

    // Electron 下 a.download 不触发 playwright download 事件：在页面内截获 blob 内容作为导出产物
    await page!.evaluate(() => {
      (window as unknown as { __cclabBlobs: string[] }).__cclabBlobs = [];
      const orig = URL.createObjectURL.bind(URL);
      URL.createObjectURL = (blob: Blob): string => {
        void blob.text().then((t) => (window as unknown as { __cclabBlobs: string[] }).__cclabBlobs.push(t));
        return orig(blob);
      };
    });
    await page!.getByRole('button', { name: /导出全部数据/ }).click();
    await (page!.getByText(/已导出备份/)).waitFor({ state: 'visible', timeout: 30_000 });
    const blobs = await page!.evaluate(() => (window as unknown as { __cclabBlobs?: string[] }).__cclabBlobs ?? []);
    expect(blobs.length).toBeGreaterThan(0);
    const backup = blobs[0]!;
    expect(backup).toContain('progress'); // 导出含学习进度
    const backupPath = path.join(userDataDir, 'backup.json');
    await writeFile(backupPath, backup, 'utf8');

    // 清空（二次确认）
    await page!.getByRole('button', { name: /清空全部数据…/ }).click();
    await page!.getByRole('button', { name: '确认清空全部数据' }).click();
    await (page!.getByText(/数据已清空/)).waitFor({ state: 'visible', timeout: 30_000 });
    // 清空后课程进度消失：翻到最后一节，按钮必须是"完成本章"（未完成）而非"已完成本章"
    await page!.waitForTimeout(2000);
    await goto(page!, '#/course/1');
    await gotoLastSection(page!);
    const afterClear = await page!.getByRole('button', { name: /完成本章|已完成本章/ }).first().textContent();
    expect(afterClear).toBe('完成本章');

    // 导入（校验 → 预览 → 确认）
    await goto(page!, '#/settings');
    await page!.getByRole('button', { name: /导出全部数据/ }).waitFor({ state: 'visible', timeout: 30_000 });
    const fileInput = page!.locator('input[aria-label="选择备份 JSON 文件"]');
    await fileInput.setInputFiles(backupPath);
    await (page!.getByText(/校验通过/)).waitFor({ state: 'visible', timeout: 30_000 });
    await page!.getByRole('button', { name: '确认导入' }).click();
    await (page!.getByText(/导入完成/)).waitFor({ state: 'visible', timeout: 60_000 });
    // 恢复验证：章节 1 仍为已完成
    await page!.waitForTimeout(2500); // 导入后自动刷新
    await goto(page!, '#/course/1');
    const doneBtn = page!.getByRole('button', { name: /已完成本章/ }).first();
    for (let i = 0; i < 30; i++) {
      if (await doneBtn.isVisible().catch(() => false)) break;
      const next = page!.getByRole('button', { name: /下一节 →/ }).first();
      const disabled = await next.isDisabled().catch(() => true);
      if (disabled) break;
      await next.click();
      await page!.waitForTimeout(150);
    }
    await doneBtn.waitFor({ state: 'visible', timeout: 30_000 });
  });
});
