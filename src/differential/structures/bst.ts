/**
 * BST 差分套件：insert/search/delete（删除覆盖 leaf / one child / two children / root / 不存在）。
 * C 侧 = BST_C_CODE 教学代码（局部 root，无全局态）。
 * 语义投影：inorder（集合排序序）+ search 的 found 观察中途捕获结构差异。
 */
import { BST_C_CODE, bstFrom, bstInsert, bstSearch, bstDelete, bstInorder } from '../../core/data-structures/bst';
import type { TreeState } from '../../core/types';
import { mulberry32 } from '../rng';
import type { DifferentialCase, StructureSuite, TsRunResult } from '../types';
import { hasVisit, lastState } from '../framework';

function runTs(c: DifferentialCase): TsRunResult {
  const observations: string[] = [];
  let state: TreeState = lastState(bstFrom(c.initial.values ?? []))!;
  for (const op of c.operations) {
    const [a0] = op.args as number[];
    switch (op.op) {
      case 'insert': {
        const out = bstInsert(state, a0);
        observations.push(`insert rc=${out.ok ? 0 : -1}`);
        state = lastState(out) ?? state;
        break;
      }
      case 'search': {
        const out = bstSearch(state, a0);
        observations.push(`search found=${hasVisit(out) ? 1 : 0}`);
        break;
      }
      case 'delete': {
        const out = bstDelete(state, a0);
        observations.push(`delete rc=${out.ok ? 0 : -1}`);
        state = lastState(out) ?? state;
        break;
      }
      default:
        throw new Error(`bst: 未知操作 ${op.op}`);
    }
  }
  const inorder = bstInorder(state);
  return { state: { kind: 'bst', inorder, size: inorder.length }, observations };
}

function generateC(cases: DifferentialCase[]): string {
  const lines: string[] = [];
  lines.push(...BST_C_CODE);
  lines.push(
    'static int cclabCount(TreeNode *root) {',
    '    if (root == NULL) return 0;',
    '    return 1 + cclabCount(root->left) + cclabCount(root->right);',
    '}',
    'static void cclabInorder(TreeNode *root, int *out, int *n) {',
    '    if (root == NULL) return;',
    '    cclabInorder(root->left, out, n);',
    '    out[(*n)++] = root->data;',
    '    cclabInorder(root->right, out, n);',
    '}',
    'static void cclabPrintState(TreeNode *root) {',
    '    int buf[256], n = 0;',
    '    cclabInorder(root, buf, &n);',
    '    printf("IN:[");',
    '    for (int i = 0; i < n; i++) { printf("%s%d", i ? "," : "", buf[i]); }',
    '    printf("]\\nSIZE:%d\\n", n);',
    '}',
    'static void cclabFree(TreeNode *root) {',
    '    if (root == NULL) return;',
    '    cclabFree(root->left);',
    '    cclabFree(root->right);',
    '    free(root);',
    '}',
    'int main(void) {',
  );
  cases.forEach((c, ci) => {
    const vals = c.initial.values ?? [];
    lines.push(`    printf("BEGIN ${ci}\\n");`);
    lines.push('    {');
    lines.push('        TreeNode *root = NULL;');
    vals.forEach((v) => lines.push(`        root = bstInsert(root, ${v});`));
    for (const op of c.operations) {
      const [a0] = op.args as number[];
      switch (op.op) {
        case 'insert':
          lines.push(`        root = bstInsert(root, ${a0}); printf("OBS:insert rc=0\\n");`);
          break;
        case 'search':
          lines.push(`        printf("OBS:search found=%d\\n", bstSearch(root, ${a0}) != NULL ? 1 : 0);`);
          break;
        case 'delete':
          // 教学 bstDelete 对不存在的值静默返回原树：用节点数变化判定成败（与 TS fail 语义等价）
          lines.push(
            `        { int before = cclabCount(root); root = bstDelete(root, ${a0}); int after = cclabCount(root);`,
            `          printf("OBS:delete rc=%d\\n", before > after ? 0 : -1); }`,
          );
          break;
        default:
          throw new Error(`bst C: 未知操作 ${op.op}`);
      }
    }
    lines.push('        cclabPrintState(root);');
    lines.push('        cclabFree(root);');
    lines.push('    }');
    lines.push(`    printf("END ${ci}\\n");`);
  });
  lines.push('    return 0;', '}');
  return lines.join('\n');
}

function generateCases(seed: number, count: number): DifferentialCase[] {
  const out: DifferentialCase[] = [];
  for (let i = 0; i < count; i++) {
    const rng = mulberry32(seed * 100003 + i + 53);
    const initLen = rng.int(0, 15);
    // 小值域制造重复值（验证相等忽略语义）
    const values = Array.from({ length: initLen }, () => rng.int(-20, 20));
    const operations = [];
    const nOps = rng.int(20, 100);
    const pool = [...values];
    for (let j = 0; j < nOps; j++) {
      const kind = rng.int(0, 2);
      if (kind === 0) {
        const v = rng.bool(0.6) && pool.length > 0 ? pool[rng.int(0, pool.length - 1)]! : rng.int(-20, 20);
        operations.push({ op: 'insert', args: [v] });
        pool.push(v);
      } else if (kind === 1) {
        const v = rng.bool(0.7) && pool.length > 0 ? pool[rng.int(0, pool.length - 1)]! : rng.int(-20, 20);
        operations.push({ op: 'search', args: [v] });
      } else {
        const v = rng.bool(0.7) && pool.length > 0 ? pool[rng.int(0, pool.length - 1)]! : rng.int(-20, 20);
        operations.push({ op: 'delete', args: [v] });
        const k = pool.indexOf(v);
        if (k >= 0) pool.splice(k, 1);
      }
    }
    out.push({ structure: 'bst', seed, initial: { structure: 'bst', values }, operations });
  }
  return out;
}

export const bstSuite: StructureSuite = { id: 'bst', generateCases, runTs, generateC };
