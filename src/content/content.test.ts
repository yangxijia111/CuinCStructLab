import { describe, expect, it } from 'vitest';
import { C_PROGRAMS, CHAPTERS, SECTION_ORDER } from './index';

describe('课程内容完整性', () => {
  it('共 14 章，id 为 0..13 且唯一', () => {
    expect(CHAPTERS).toHaveLength(14);
    expect(CHAPTERS.map((c) => c.id)).toEqual(Array.from({ length: 14 }, (_, i) => i));
  });

  it('每章 14 段教学结构齐全且按顺序', () => {
    for (const ch of CHAPTERS) {
      const kinds = ch.sections.map((s) => s.kind);
      expect(kinds, `第${ch.id}章 段落种类`).toEqual(SECTION_ORDER);
      for (const s of ch.sections) {
        expect(s.title.length, `第${ch.id}章 ${s.kind} 标题非空`).toBeGreaterThan(0);
        // 每段至少有一种内容
        const hasContent =
          (s.body ?? []).length > 0 || (s.bullets ?? []).length > 0 || s.codeId !== undefined ||
          (s.vizOps ?? []).length > 0 || s.table !== undefined || (s.quizIds ?? []).length > 0 ||
          (s.problemIds ?? []).length > 0;
        expect(hasContent, `第${ch.id}章 ${s.kind} 有内容`).toBe(true);
      }
    }
  });

  it('章节标题与关键词非空', () => {
    for (const ch of CHAPTERS) {
      expect(ch.title.length).toBeGreaterThan(0);
      expect(ch.subtitle.length).toBeGreaterThan(0);
      expect(ch.keywords.length).toBeGreaterThan(0);
    }
  });

  it('所有 codeId 都能解析到注册的 C 程序', () => {
    for (const ch of CHAPTERS) {
      for (const s of ch.sections) {
        if (s.codeId !== undefined) {
          expect(C_PROGRAMS[s.codeId], `第${ch.id}章引用 ${s.codeId}`).toBeDefined();
        }
      }
    }
  });

  it('C 程序 id 全局唯一且代码非空', () => {
    const all = Object.values(C_PROGRAMS);
    expect(all.length).toBeGreaterThan(15);
    for (const p of all) {
      expect(p.lines.length, `${p.id} 行数`).toBeGreaterThan(3);
    }
  });

  it('核心章（2-13）的 vizOps 均有动画小节', () => {
    for (const ch of CHAPTERS.slice(2)) {
      const anim = ch.sections.find((s) => s.kind === 'animation');
      expect((anim?.vizOps ?? []).length, `第${ch.id}章动画操作数`).toBeGreaterThan(0);
    }
  });
});
