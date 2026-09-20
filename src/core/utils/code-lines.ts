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

/** 由若干 needle 构建行号表（模块加载时一次性计算） */
export function buildLineMap<M extends string>(code: readonly string[], needles: Record<M, string>): Record<M, number> {
  const result = {} as Record<M, number>;
  for (const key of Object.keys(needles) as M[]) {
    result[key] = findLine(code, needles[key]!);
  }
  return result;
}
