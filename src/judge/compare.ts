/**
 * 判题输出比对规范化（JUDGE_SPEC §2）。
 * 顺序：CRLF/LF 统一 → 行尾空白去除 → 末尾换行忽略 → 逐字符严格比较。
 */

/** 规范化输出（用于展示 diff 与比较） */
export function normalizeOutput(raw: string): string {
  const unified = raw.replace(/\r\n?/g, '\n');
  const trimmedLineEnds = unified
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/g, ''))
    .join('\n');
  return trimmedLineEnds.replace(/\n+$/g, '');
}

/** 判定实际输出是否与期望一致 */
export function outputMatches(expected: string, actual: string): boolean {
  return normalizeOutput(expected) === normalizeOutput(actual);
}

/** 首个差异行（展示 WA 用）；完全一致返回 null */
export function firstDiffLine(expected: string, actual: string): { lineNo: number; expected: string; actual: string } | null {
  const e = normalizeOutput(expected).split('\n');
  const a = normalizeOutput(actual).split('\n');
  const len = Math.max(e.length, a.length);
  for (let i = 0; i < len; i++) {
    const el = e[i] ?? '（缺失）';
    const al = a[i] ?? '（缺失）';
    if (el !== al) {
      return { lineNo: i + 1, expected: el, actual: al };
    }
  }
  return null;
}

/** 截断过长输出（runner 输出上限 1MB） */
export function truncateOutput(raw: string, maxBytes = 1024 * 1024): { text: string; truncated: boolean } {
  if (raw.length <= maxBytes) return { text: raw, truncated: false };
  return { text: `${raw.slice(0, maxBytes)}\n…（输出超过 ${maxBytes} 字节，已截断）`, truncated: true };
}
