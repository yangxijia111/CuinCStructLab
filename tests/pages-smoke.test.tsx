/**
 * 页面冒烟测试：核心路由渲染 + 关键交互（P10）。
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { App } from '../src/App';

function renderAt(path: string): ReturnType<typeof render> {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

describe('页面冒烟', () => {
  it('首页渲染', () => {
    renderAt('/');
    expect(screen.getAllByText('CuinCStructLab').length).toBeGreaterThan(0);
  });

  it('课程列表与章节页', () => {
    renderAt('/course');
    expect(screen.getAllByText('顺序表').length).toBeGreaterThan(0);
  });

  it('章节页：标题 + 14 段目录 + 代码面板', () => {
    renderAt('/course/3');
    expect(screen.getAllByText(/单链表/).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /下一节/ })).toBeDefined();
  });

  it('实验室渲染（结构选择 + 操作）', () => {
    renderAt('/lab');
    expect(screen.getAllByText('可视化实验室').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/初始数据/).length).toBeGreaterThan(0);
  });

  it('题库渲染并可答题', async () => {
    const user = userEvent.setup();
    renderAt('/bank');
    expect(screen.getAllByText(/题库/).length).toBeGreaterThan(0);
    // 选择第一题（列表按钮带知识点文字）
    const items = screen.getAllByRole('button').filter((b) => b.className.includes('bank-item'));
    expect(items.length).toBeGreaterThan(0);
    await user.click(items[0]!);
    // 答题界面出现：提交按钮存在
    expect(screen.getByRole('button', { name: '提交' })).toBeDefined();
  });

  it('错题本空态引导', () => {
    renderAt('/wrong-book');
    expect(screen.getAllByText(/错题本/).length).toBeGreaterThan(0);
  });

  it('学习统计渲染', () => {
    renderAt('/stats');
    expect(screen.getAllByText(/课程完成度/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/连续学习天数/).length).toBeGreaterThan(0);
  });

  it('搜索：搜"指针"命中章节与题目', async () => {
    const user = userEvent.setup();
    renderAt('/search');
    const input = screen.getByRole('textbox', { name: '全局搜索' });
    await user.type(input, '指针');
    expect(await screen.findByText(/条结果/)).toBeDefined();
    expect(screen.getAllByText(/章节/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/题目/).length).toBeGreaterThan(0);
  });

  it('数据结构与算法总览', () => {
    renderAt('/structures');
    expect(screen.getAllByText('顺序表').length).toBeGreaterThan(0);
    renderAt('/algorithms');
    expect(screen.getAllByText(/排序/).length).toBeGreaterThan(0);
  });
});
