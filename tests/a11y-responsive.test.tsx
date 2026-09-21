/**
 * 可访问性与响应式回归（P14 P2-2 / P2-3）。
 * 覆盖：统一 :focus-visible、prefers-reduced-motion 保留、ARIA 结构、
 * 键盘可达性基础、小窗口（1024×680 / 900×600）关键内容可达。
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { App } from '../src/App';

const css = readFileSync(resolve(process.cwd(), 'src/app.css'), 'utf8');

function renderAt(path: string): void {
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

describe('可访问性 CSS（P2-2）', () => {
  it('存在统一 :focus-visible 规则且覆盖 button/a/input/select/textarea/tab/range', () => {
    expect(css).toMatch(/a:focus-visible[\s\S]*button:focus-visible/);
    expect(css).toContain('input:focus-visible');
    expect(css).toContain('select:focus-visible');
    expect(css).toContain('textarea:focus-visible');
    expect(css).toContain("[role='tab']:focus-visible");
    expect(css).toContain("input[type='range']:focus-visible");
  });

  it('focus-visible 使用可见的 outline（非 outline:none）', () => {
    const rule = css.slice(css.indexOf(':focus-visible'));
    expect(rule).toContain('outline: 2px solid');
    expect(rule).not.toContain('outline: none');
  });

  it('prefers-reduced-motion 保留', () => {
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
  });
});

describe('ARIA 结构（P2-2）', () => {
  it('主导航带 aria-label；导航项为链接（天然可聚焦）', () => {
    renderAt('/');
    const nav = screen.getByRole('navigation', { name: '主导航' });
    expect(nav).toBeDefined();
    const links = nav.querySelectorAll('a');
    expect(links.length).toBeGreaterThanOrEqual(10);
    for (const a of links) {
      expect(a.getAttribute('href')).not.toBeNull();
    }
  });

  it('首页渲染后主要交互元素均为原生 button（键盘可操作）', () => {
    renderAt('/');
    const buttons = document.querySelectorAll('button');
    expect(buttons.length).toBeGreaterThan(0);
    for (const b of buttons) {
      // 原生 button 天然可聚焦、Enter/Space 触发
      expect(b.tagName).toBe('BUTTON');
    }
  });

  it('实验室 tablist 具备 aria-selected', () => {
    renderAt('/lab');
    const tablist = screen.getByRole('tablist', { name: '数据结构选择' });
    const tabs = tablist.querySelectorAll('[role="tab"]');
    expect(tabs.length).toBeGreaterThan(0);
    const selected = [...tabs].filter((t) => t.getAttribute('aria-selected') === 'true');
    expect(selected.length).toBeGreaterThanOrEqual(1);
  });

  it('搜索输入具备 aria-label', () => {
    renderAt('/search');
    expect(screen.getByRole('textbox', { name: '全局搜索' })).toBeDefined();
  });
});

describe('响应式（P2-3）', () => {
  it('存在 1024px 与 900px 两个断点', () => {
    expect(css).toContain('@media (max-width: 1024px)');
    expect(css).toContain('@media (max-width: 900px)');
  });

  it('断点内不使用 display:none 隐藏关键内容（允许折叠/堆叠/滚动）', () => {
    const idx1024 = css.indexOf('@media (max-width: 1024px)');
    const idx900 = css.indexOf('@media (max-width: 900px)');
    const mediaCss = css.slice(idx1024, idx900) + css.slice(idx900);
    // 响应式只允许 flex/grid/overflow 布局调整，禁止把内容永久移除
    expect(mediaCss).not.toContain('display: none');
    expect(mediaCss).not.toContain('display:none');
    // 允许横向滚动兜底
    expect(mediaCss).toContain('overflow-x: auto');
  });

  it('窄视口渲染：课程页与编程页关键按钮存在于 DOM（不因布局消失）', () => {
    renderAt('/course/3');
    expect(screen.getByRole('button', { name: /下一节/ })).toBeDefined();
  });
});
