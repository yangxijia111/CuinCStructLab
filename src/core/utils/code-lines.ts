/**
 * 教学 C 代码行定位器：按文本内容查找行号（1-based），杜绝硬编码行号漂移。
 * C_CODE_SPEC §4：Step.codeLine 必须指向真实存在的行；本工具保证这一点。
 */

/** 在代码行数组中查找包含 needle 的第一行（从 from 起）；找不到返回 0 */
export function findLine(code: readonly string[], needle: string, from = 0): number {
  for (let i = from; i < code.length; i++) {
    if (code[i]!.includes(needle)) return i + 1;
  }
  return 0;
}

/**
 * needle 规格：
 * - 字符串：全文找第一处包含；
 * - [文本, 锚文本]：先定位锚文本所在行，再从该行（含）起查找文本。
 *   用于同一文本在多个函数中重复出现的场景（如各遍历函数里的判空行）。
 */
export type LineNeedle = string | readonly [text: string, anchor: string];

/** 由若干 needle 构建行号表（模块加载时一次性计算） */
export function buildLineMap<M extends string>(code: readonly string[], needles: Record<M, LineNeedle>): Record<M, number> {
  const result = {} as Record<M, number>;
  for (const key of Object.keys(needles) as M[]) {
    const spec = needles[key]!;
    if (typeof spec === 'string') {
      result[key] = findLine(code, spec);
    }
  }
  for (const key of Object.keys(needles) as M[]) {
    const spec = needles[key]!;
    if (typeof spec !== 'string') {
      const anchorLine = findLine(code, spec[1]);
      result[key] = anchorLine === 0 ? 0 : findLine(code, spec[0], anchorLine - 1);
    }
  }
  return result;
}
