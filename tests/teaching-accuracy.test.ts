/**
 * 教学内容准确性审计（P14 P2-1）：
 * 复杂度描述必须带限定条件，防止"为简单易懂而写错误结论"回归。
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CHAPTERS } from '../src/content';

const readSrc = (p: string): string => readFileSync(resolve(process.cwd(), p), 'utf8');
const allContent = CHAPTERS.map((c) => `${c.subtitle}\n${JSON.stringify(c)}`).join('\n');

describe('复杂度描述教学准确性', () => {
  it('单链表：不得孤立宣称"插入删除 O(1)"，必须说明定位开销', () => {
    const ch3 = CHAPTERS.find((c) => c.id === 3);
    expect(ch3).toBeDefined();
    const text = JSON.stringify(ch3);
    // 必须明确"定位 O(n) / 接线 O(1)"的区分
    expect(text).toContain('O(n) 定位');
    expect(text).toContain('O(1) 接线');
    expect(text).toContain('定位');
  });

  it('单链表 subtitle 不再使用未限定的"插入删除 O(1)"表述', () => {
    const ch3 = CHAPTERS.find((c) => c.id === 3)!;
    expect(ch3.subtitle).toContain('O(n)');
    expect(ch3.subtitle).toContain('O(1)');
  });

  it('BST：必须写明平均/平衡 O(log n) 与最坏退化 O(n)', () => {
    const ch9 = CHAPTERS.find((c) => c.id === 9);
    expect(ch9).toBeDefined();
    const text = JSON.stringify(ch9);
    expect(text).toContain('平均');
    expect(text).toContain('O(log n)');
    expect(text).toContain('退化');
    expect(text).toContain('O(n)');
  });

  it('树章节概览：不得出现未限定的"查找做到 O(log n)"', () => {
    const ch8 = CHAPTERS.find((c) => c.id === 8)!;
    const text = JSON.stringify(ch8);
    expect(text).not.toContain('可以把查找做到 O(log n)');
    expect(text).toContain('平衡');
  });

  it('快排：必须标注最坏 O(n²)', () => {
    expect(allContent).toContain('O(n²)');
  });

  it('二分查找：必须标注"必须有序"前提', () => {
    const ch12 = CHAPTERS.find((c) => c.id === 12)!;
    const text = JSON.stringify(ch12);
    expect(text).toContain('必须有序');
  });

  it('源码级检查：链表复杂度表保留"定位 + 接线"分解', () => {
    const src = readSrc('src/content/chapters/ch02-07.ts');
    expect(src).toContain("O(n) 定位 + O(1) 接线");
  });
});
