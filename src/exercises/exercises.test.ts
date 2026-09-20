import { describe, expect, it } from 'vitest';
import { ALL_EXERCISES, coveredTypes, exercisesByChapter, getExercise, searchExercises } from './bank';
import { judge, standardAnswerText } from './types';

describe('题库完整性（FR-EXE）', () => {
  it('总量 ≥ 84，每章 ≥ 6 题', () => {
    expect(ALL_EXERCISES.length).toBeGreaterThanOrEqual(84);
    for (let ch = 0; ch <= 13; ch++) {
      expect(exercisesByChapter(ch).length, `第${ch}章`).toBeGreaterThanOrEqual(6);
    }
  });

  it('id 全局唯一且格式为 chXX-qYY', () => {
    const ids = ALL_EXERCISES.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const e of ALL_EXERCISES) {
      expect(e.id).toMatch(/^ch\d{2}-q\d{2}$/);
      expect(e.chapter).toBe(Number(e.id.slice(2, 4)));
    }
  });

  it('覆盖全部 8 种题型', () => {
    const types = coveredTypes();
    for (const t of ['single', 'multiple', 'judge', 'fill', 'code-read', 'exec-result', 'bug-find', 'code-complete']) {
      expect(types.has(t as never), `缺题型 ${t}`).toBe(true);
    }
  });

  it('answer 结构与题型匹配', () => {
    for (const e of ALL_EXERCISES) {
      // 题型 → 答案结构约束
      if (e.type === 'single' || e.type === 'multiple' || e.type === 'bug-find') {
        expect(e.options, `${e.id} 需要选项`).toBeDefined();
        const answerValue = e.answer.type === 'multiple' ? e.answer.value : [e.answer.value as string];
        for (const v of answerValue) {
          expect(e.options?.some((o) => o.id === v), `${e.id} 答案 ${v} 在选项中`).toBe(true);
        }
        if (e.type === 'multiple') expect(answerValue.length).toBeGreaterThanOrEqual(2);
      }
      if (e.type === 'fill') {
        expect(e.answer.type).toBe('text');
        if (e.answer.type === 'text') {
          expect(e.answer.value.length).toBeGreaterThan(0);
        }
      }
      if (e.type === 'code-read' || e.type === 'exec-result') {
        // 两种形态均可：填写式（text + 候选答案）或选择式（single + options）
        if (e.answer.type === 'text' && e.answer.value.length === 0) {
          throw new Error(`${e.id} 候选答案为空`);
        } else if (e.answer.type !== 'text') {
          expect(e.answer.type, `${e.id} 选择式应为 single`).toBe('single');
          expect(e.options).toBeDefined();
        }
      }
      if (e.type === 'code-complete') {
        expect(e.answer.type).toBe('blanks');
      }
      if (e.type === 'judge') {
        expect(e.answer.type).toBe('judge');
      }
      expect(e.explanation.length, `${e.id} 有解析`).toBeGreaterThan(5);
      expect(e.tags.length, `${e.id} 有标签`).toBeGreaterThan(0);
      expect(e.errorCategory, `${e.id} 有错因`).toBeDefined();
    }
  });

  it('getExercise / searchExercises', () => {
    expect(getExercise('ch03-q01')?.knowledgePoint).toBe('链表插入顺序');
    expect(searchExercises('指针').length).toBeGreaterThanOrEqual(3);
    expect(searchExercises('循环队列').length).toBeGreaterThanOrEqual(2);
    expect(searchExercises('')).toEqual([]);
  });
});

describe('判分引擎（8 题型矩阵）', () => {
  it('单选：对/错', () => {
    const e = getExercise('ch00-q01')!;
    expect(judge(e, 'B').correct).toBe(true);
    expect(judge(e, 'A').correct).toBe(false);
    expect(judge(e, null).correct).toBe(false);
  });

  it('多选：全对才得分，漏选/多选均错', () => {
    const e = getExercise('ch00-q03')!; // ABD
    expect(judge(e, ['A', 'B', 'D']).correct).toBe(true);
    expect(judge(e, ['B', 'D', 'A']).correct).toBe(true); // 顺序无关
    expect(judge(e, ['A', 'B']).correct).toBe(false); // 漏选
    expect(judge(e, ['A', 'B', 'C', 'D']).correct).toBe(false); // 多选
    expect(judge(e, ['A']).correct).toBe(false);
  });

  it('判断：布尔匹配', () => {
    const e = getExercise('ch00-q02')!;
    expect(judge(e, true).correct).toBe(true);
    expect(judge(e, false).correct).toBe(false);
  });

  it('填空：忽略首尾空白，多候选任一匹配；大小写敏感', () => {
    const e = getExercise('ch00-q06')!; // 24
    expect(judge(e, '24').correct).toBe(true);
    expect(judge(e, '  24  ').correct).toBe(true);
    expect(judge(e, '23').correct).toBe(false);
  });

  it('代码补全：全部空正确才得分', () => {
    const e = ALL_EXERCISES.find((x) => x.id === 'ch03-q05')!;
    expect(judge(e, ['current = next', 'head']).correct).toBe(true);
    expect(judge(e, ['current = next', 'current']).correct).toBe(false);
    expect(judge(e, ['current=next', 'head']).correct).toBe(true); // 内部空白不敏感（trim 后）
  });

  it('标准答案文本可生成', () => {
    for (const e of ALL_EXERCISES.slice(0, 20)) {
      expect(standardAnswerText(e).length).toBeGreaterThan(0);
    }
  });
});
