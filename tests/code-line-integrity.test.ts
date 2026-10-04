/**
 * 教学 C 代码行号表完整性（防回归）：
 * P16 全面审查发现大量 needle 解析错位（重复文本命中首现函数、拼写不符解析为 0、
 * 硬编码行号指向注释/闭括号）。本文件固化两类断言：
 *   1) 所有 L 表项解析到有效行（1..len，杜绝 needle 拼写漂移后静默变 0）
 *   2) 关键锚定 needle（[文本, 锚] 形式）指向锚所在函数内的行
 */
import { describe, expect, it } from 'vitest';
import { L as SEQLIST_L, SEQ_LIST_C_CODE } from '../src/core/data-structures/seqlist';
import { L as LINKED_L, LINKED_LIST_C_CODE } from '../src/core/data-structures/linked-list';
import { L as DOUBLY_L, DOUBLY_LIST_C_CODE } from '../src/core/data-structures/doubly-list';
import { L as QUEUE_L, QUEUE_C_CODE } from '../src/core/data-structures/queue';
import { L as STACK_L, STACK_C_CODE } from '../src/core/data-structures/stack';
import { L as HEAP_L, HEAP_C_CODE } from '../src/core/data-structures/heap';
import { L as BST_L, BST_C_CODE } from '../src/core/data-structures/bst';
import { L as TREE_L, TREE_C_CODE } from '../src/core/data-structures/tree';
import { L as GRAPH_L, GRAPH_C_CODE } from '../src/core/data-structures/graph';

const MODULES: Array<[string, Record<string, number>, string[]]> = [
  ['SEQLIST', SEQLIST_L as unknown as Record<string, number>, SEQ_LIST_C_CODE],
  ['LINKED_LIST', LINKED_L as unknown as Record<string, number>, LINKED_LIST_C_CODE],
  ['DOUBLY_LIST', DOUBLY_L as unknown as Record<string, number>, DOUBLY_LIST_C_CODE],
  ['QUEUE', QUEUE_L as unknown as Record<string, number>, QUEUE_C_CODE],
  ['STACK', STACK_L as unknown as Record<string, number>, STACK_C_CODE],
  ['HEAP', HEAP_L as unknown as Record<string, number>, HEAP_C_CODE],
  ['BST', BST_L as unknown as Record<string, number>, BST_C_CODE],
  ['TREE', TREE_L as unknown as Record<string, number>, TREE_C_CODE],
  ['GRAPH', GRAPH_L as unknown as Record<string, number>, GRAPH_C_CODE],
];

describe('L 表完整性：所有 needle 必须解析到有效行', () => {
  for (const [name, L, code] of MODULES) {
    it(`${name}：${Object.keys(L).length} 个 needle 全部命中 1..${code.length}`, () => {
      for (const [key, line] of Object.entries(L)) {
        expect(line, `${name}.${key} 解析失败（needle 不再匹配代码文本）`).toBeGreaterThanOrEqual(1);
        expect(line, `${name}.${key} 越界`).toBeLessThanOrEqual(code.length);
      }
    });
  }
});

describe('L 表锚定正确性：同名文本必须落在各自函数内', () => {
  /** 断言 L[key] 落在锚函数头行与下一个函数之间（锚函数内） */
  function expectWithin(code: string[], key: string, line: number, fnHeader: string): void {
    const fnLine = code.findIndex((l) => l.includes(fnHeader));
    expect(fnLine, `${fnHeader} 不存在`).toBeGreaterThanOrEqual(0);
    // 函数体：从函数头到下一个顶格 '}' 或空行后的顶层声明
    let end = code.length - 1;
    for (let i = fnLine + 1; i < code.length; i++) {
      if (code[i] === '}') {
        end = i;
        break;
      }
    }
    expect(line, `${key}（行 ${line}）应落在 ${fnHeader} 函数体（${fnLine + 1}..${end + 1}）内`).toBeGreaterThan(fnLine);
    expect(line, `${key}（行 ${line}）应落在 ${fnHeader} 函数体（${fnLine + 1}..${end + 1}）内`).toBeLessThanOrEqual(end + 1);
  }

  it('TREE：三种遍历的判空行各自指向本函数', () => {
    expectWithin(TREE_C_CODE, 'preNull', TREE_L.preNull, 'void preorder(');
    expectWithin(TREE_C_CODE, 'inNull', TREE_L.inNull, 'void inorder(');
    expectWithin(TREE_C_CODE, 'postNull', TREE_L.postNull, 'void postorder(');
    expectWithin(TREE_C_CODE, 'levelPrint', TREE_L.levelPrint, 'void levelOrder(');
  });

  it('LINKED_LIST：pushBack/insert/deleteValue/deleteAt/find/traverse/set/destroy 各自的关键行不串函数', () => {
    expectWithin(LINKED_LIST_C_CODE, 'pushBackMalloc', LINKED_L.pushBackMalloc, 'int listPushBack(');
    expectWithin(LINKED_LIST_C_CODE, 'insertMalloc', LINKED_L.insertMalloc, 'int listInsertAt(');
    expectWithin(LINKED_LIST_C_CODE, 'delValPrev', LINKED_L.delValPrev, 'int listDeleteValue(');
    expectWithin(LINKED_LIST_C_CODE, 'delValMove', LINKED_L.delValMove, 'int listDeleteValue(');
    expectWithin(LINKED_LIST_C_CODE, 'delAtPrev', LINKED_L.delAtPrev, 'int listDeleteAt(');
    expectWithin(LINKED_LIST_C_CODE, 'delAtMove', LINKED_L.delAtMove, 'int listDeleteAt(');
    expectWithin(LINKED_LIST_C_CODE, 'delAtTarget', LINKED_L.delAtTarget, 'int listDeleteAt(');
    expectWithin(LINKED_LIST_C_CODE, 'delAtBypass', LINKED_L.delAtBypass, 'int listDeleteAt(');
    expectWithin(LINKED_LIST_C_CODE, 'delAtFree', LINKED_L.delAtFree, 'int listDeleteAt(');
    expectWithin(LINKED_LIST_C_CODE, 'findMove', LINKED_L.findMove, 'Node *listFind(');
    expectWithin(LINKED_LIST_C_CODE, 'traverseCurrent', LINKED_L.traverseCurrent, 'void listTraverse(');
    expectWithin(LINKED_LIST_C_CODE, 'traverseMove', LINKED_L.traverseMove, 'void listTraverse(');
    expectWithin(LINKED_LIST_C_CODE, 'setMiss', LINKED_L.setMiss, 'int listSet(');
    expectWithin(LINKED_LIST_C_CODE, 'destroyCurrent', LINKED_L.destroyCurrent, 'void listDestroy(');
  });

  it('DOUBLY_LIST：尾插/删除/反向遍历各行正确', () => {
    expectWithin(DOUBLY_LIST_C_CODE, 'pushBackMalloc', DOUBLY_L.pushBackMalloc, 'int listPushBack(');
    expectWithin(DOUBLY_LIST_C_CODE, 'delMiss', DOUBLY_L.delMiss, 'int listDeleteValue(');
    expectWithin(DOUBLY_LIST_C_CODE, 'bwdSeek', DOUBLY_L.bwdSeek, 'void traverseBackward(');
    expectWithin(DOUBLY_LIST_C_CODE, 'bwdPrint', DOUBLY_L.bwdPrint, 'void traverseBackward(');
  });

  it('SEQLIST：find/set/destroy 各自的行不串函数', () => {
    expectWithin(SEQ_LIST_C_CODE, 'findMiss', SEQLIST_L.findMiss, 'int seqListFind(');
    expectWithin(SEQ_LIST_C_CODE, 'setRange', SEQLIST_L.setRange, 'int seqListSet(');
    expectWithin(SEQ_LIST_C_CODE, 'setWrite', SEQLIST_L.setWrite, 'int seqListSet(');
    expectWithin(SEQ_LIST_C_CODE, 'destroyFree', SEQLIST_L.destroyFree, 'void seqListDestroy(');
  });

  it('QUEUE：链队列出队置空行指向 lqDequeue（而非 lqInit）', () => {
    expectWithin(QUEUE_C_CODE, 'lqDeqRear', QUEUE_L.lqDeqRear, 'int lqDequeue(');
  });
});
