# -*- coding: utf-8 -*-
"""tree/bst/heap/graph 行号表改造（P5 行号审计修复）"""
import re

ROOT = ''


def insert_map(path, code_var, lblock):
    src = open(path, encoding='utf-8').read()
    if 'buildLineMap' not in src:
        lines = src.split('\n')
        last_import = max(i for i, l in enumerate(lines) if l.startswith('import '))
        lines.insert(last_import + 1, "import { buildLineMap } from '../utils/code-lines';")
        src = '\n'.join(lines)
    lines = src.split('\n')
    start = next(i for i, l in enumerate(lines) if f'export const {code_var}' in l)
    end = next(i for i in range(start, len(lines)) if lines[i].strip() == '];')
    lines.insert(end + 1, '\n' + lblock.strip('\n'))
    open(path, 'w', encoding='utf-8', newline='\n').write('\n'.join(lines))


def repl(path, reps):
    src = open(path, encoding='utf-8').read()
    for old, new in reps:
        if old in src:
            src = src.replace(old, new)
        else:
            print(f'MISS {path}: {old[:70]!r}')
    open(path, 'w', encoding='utf-8', newline='\n').write(src)


# ===== tree.ts =====
insert_map('src/core/data-structures/tree.ts', 'TREE_C_CODE', """
const L = buildLineMap(TREE_C_CODE, {
  newNodeMalloc: 'TreeNode *node = (TreeNode *)malloc(sizeof(TreeNode));',
  preFn: 'void preorder(TreeNode *node) {',
  preNull: 'if (node == NULL) {',
  prePrint: '① 先访问根',
  preLeft: '② 再递归左子树',
  preRight: '③ 最后递归右子树',
  inFn: 'void inorder(TreeNode *node) {',
  inNull: 'if (node == NULL) {',
  inLeft: '① 先走左',
  inPrint: '② 输出根',
  inRight: '③ 再走右',
  postFn: 'void postorder(TreeNode *node) {',
  postNull: 'if (node == NULL) {',
  postLeft: 'postorder(node->left);',
  postRight: 'postorder(node->right);',
  postPrint: '③ 根',
  levelFn: 'void levelOrder(TreeNode *root) {',
  levelRoot: 'queue[rear++] = root;',
  levelWhile: 'while (front < rear) {',
  levelOut: 'TreeNode *node = queue[front++];',
  levelPrint: 'printf("%d ", node->data);',
  levelLeft: 'queue[rear++] = node->left;',
  levelRight: 'queue[rear++] = node->right;',
  destroyFn: 'void destroyTree(TreeNode *node) {',
  destroyFree: 'free(node);',
});""")
repl('src/core/data-structures/tree.ts', [
    ("  const entryLine = order === 'preorder' ? 24 : order === 'inorder' ? 34 : 44;\n  const nullLine = order === 'preorder' ? 25 : order === 'inorder' ? 35 : 46;\n  const visitLine = order === 'preorder' ? 28 : order === 'inorder' ? 39 : 50;",
     "  const entryLine = order === 'preorder' ? L.preFn : order === 'inorder' ? L.inFn : L.postFn;\n  const nullLine = order === 'preorder' ? L.preNull : order === 'inorder' ? L.inNull : L.postNull;\n  const visitLine = order === 'preorder' ? L.prePrint : order === 'inorder' ? L.inPrint : L.postPrint;\n  const leftLine = order === 'preorder' ? L.preLeft : order === 'inorder' ? L.inLeft : L.postLeft;\n  const rightLine = order === 'preorder' ? L.preRight : order === 'inorder' ? L.inRight : L.postRight;"),
    ("          codeLine: order === 'preorder' ? 29 : order === 'inorder' ? 38 : 48,", '          codeLine: leftLine,'),
    ("          codeLine: order === 'preorder' ? 30 : order === 'inorder' ? 40 : 49,", '          codeLine: rightLine,'),
    ("      codeLine: order === 'preorder' ? 30 : order === 'inorder' ? 40 : 49,", '      codeLine: rightLine,'),
    ("    codeLine: 13,\n    memory: mem.snapshot(),\n    highlight: Object.keys(rec.state.nodes),", "    codeLine: L.newNodeMalloc,\n    memory: mem.snapshot(),\n    highlight: Object.keys(rec.state.nodes),"),
    ("    codeLine: 54,\n    memory: mem.snapshot(),\n    callStack: [],\n    mutate: (s) => {\n      s.visitOrder = [];", "    codeLine: L.levelFn,\n    memory: mem.snapshot(),\n    callStack: [],\n    mutate: (s) => {\n      s.visitOrder = [];"),
    ('      codeLine: 60,', '      codeLine: L.levelRoot,'),
    ('      codeLine: 62,', '      codeLine: L.levelOut,'),
    ('        codeLine: 65,', '        codeLine: L.levelLeft,'),
    ('        codeLine: 68,', '        codeLine: L.levelRight,'),
    ("    codeLine: 61,", "    codeLine: L.levelWhile,"),
    ('      codeLine: 74,', '      codeLine: L.destroyFn,'),
    ('      codeLine: 80,', '      codeLine: L.destroyFree,'),
    ("    description: '全部节点已按后序释放，无泄漏。',\n    codeLine: 80,", "    description: '全部节点已按后序释放，无泄漏。',\n    codeLine: L.destroyFree,"),
])
print('tree done')

# ===== bst.ts =====
insert_map('src/core/data-structures/bst.ts', 'BST_C_CODE', """
const L = buildLineMap(BST_C_CODE, {
  insertMalloc: 'TreeNode *node = (TreeNode *)malloc(sizeof(TreeNode));',
  insertLess: 'root->left = bstInsert(root->left, value);',
  insertGreater: 'root->right = bstInsert(root->right, value);',
  insertEnd: 'return root;',
  searchNull: 'return NULL;                 /* 走到空位 = 不存在 */',
  searchHit: 'return root;                 /* 找到 */',
  searchLeft: 'return bstSearch(root->left, value);',
  searchRight: 'return bstSearch(root->right, value);',
  delLess: 'root->left = bstDelete(root->left, value);',
  delGreater: 'root->right = bstDelete(root->right, value);',
  delFound: '找到目标节点 root',
  delLeaf: '情形一：叶节点',
  delFree: 'free(root);',
  delOnlyRight: '只有右孩子，右孩子顶替自己',
  delOnlyLeft: '只有左孩子，左孩子顶替自己',
  delTwo: '两个孩子都在',
  delPrevSeek: 'while (prev->right != NULL) {',
  delPrevCopy: 'root->data = prev->data;',
  delPrevRecur: 'root->left = bstDelete(root->left, prev->data);',
});""")
repl('src/core/data-structures/bst.ts', [
    ('      codeLine: 14,', '      codeLine: L.insertMalloc,'),
    ('        codeLine: 25,', '        codeLine: L.insertLess,'),
    ('        codeLine: 27,', '        codeLine: L.insertGreater,'),
    ('        codeLine: 29,', '        codeLine: L.insertEnd,'),
    ('    codeLine: 37,', '    codeLine: L.searchNull,'),
    ('        codeLine: 40,', '        codeLine: L.searchHit,'),
    ('      codeLine: goLeft ? 44 : 46,', '      codeLine: goLeft ? L.searchLeft : L.searchRight,'),
    ('      codeLine: goLeft ? 54 : 56,', '      codeLine: goLeft ? L.delLess : L.delGreater,'),
    ('    codeLine: 59,', '    codeLine: L.delFound,'),
    ('      codeLine: 61,', '      codeLine: L.delLeaf,'),
    ('      codeLine: 63,', '      codeLine: L.delFree,'),
    ('      codeLine: target.left === null ? 67 : 72,', '      codeLine: target.left === null ? L.delOnlyRight : L.delOnlyLeft,'),
    ('      codeLine: target.left === null ? 69 : 74,', '      codeLine: L.delFree,'),
    ('    codeLine: 77,', '    codeLine: L.delTwo,'),
    ('    codeLine: 81,', '    codeLine: L.delPrevSeek,'),
    ('    codeLine: 84,', '    codeLine: L.delPrevCopy,'),
    ('    codeLine: 85,', '    codeLine: L.delPrevRecur,'),
    ("    '没找到', `树中不存在值为 ${value} 的节点，删除失败。`, 52);", "    '没找到', `树中不存在值为 ${value} 的节点，删除失败。`, L.delLess);"),
])
print('bst done')

# ===== heap.ts =====
insert_map('src/core/data-structures/heap.ts', 'HEAP_C_CODE', """
const L = buildLineMap(HEAP_C_CODE, {
  insertWrite: 'h->data[i] = value;',
  insertStop: '不再比父节点大',
  insertSwap: 'swap(&h->data[i], &h->data[p]);',
  siftStop: '比两个孩子都大',
  siftSwap: 'swap(&h->data[i], &h->data[largest]);',
  deleteEmpty: 'return -1;        /* 空堆 */',
  deleteOut: '*out = h->data[0];',
  deleteMove: 'h->data[0] = h->data[h->size - 1];',
  heapifyFn: 'void heapify(Heap *h, int arr[], int n) {',
  heapifyLoop: 'for (int i = n / 2 - 1; i >= 0; i--)',
  heapifySift: 'siftDown(h, i, n);',
});""")
repl('src/core/data-structures/heap.ts', [
    ('    codeLine: 31,', '    codeLine: L.insertWrite,'),
    ('        codeLine: 36,', '        codeLine: L.insertStop,'),
    ('      codeLine: 40,', '      codeLine: L.insertSwap,'),
    ('        codeLine: 57,', '        codeLine: L.siftStop,'),
    ('      codeLine: 60,', '      codeLine: L.siftSwap,'),
    ('    codeLine: 70,', '    codeLine: L.deleteOut,'),
    ('      codeLine: 72,', '      codeLine: L.deleteEmpty,'),
    ('    codeLine: 71,', '    codeLine: L.deleteMove,'),
    ("    '空堆', 'h->size == 0，没有元素可删除。', 66);", "    '空堆', 'h->size == 0，没有元素可删除。', L.deleteEmpty);"),
    ('    codeLine: 78,', '    codeLine: L.heapifyFn,'),
    ('    codeLine: 83,', '    codeLine: L.heapifyLoop,'),
    ('      codeLine: 84,', '      codeLine: L.heapifySift,'),
])
print('heap done')

# ===== graph.ts =====
insert_map('src/core/data-structures/graph.ts', 'GRAPH_C_CODE', """
const L = buildLineMap(GRAPH_C_CODE, {
  addEdgeFn: 'void mgAddEdge(',
  addEdgeWrite: 'g->matrix[u][v] = 1;',
  removeEdgeFn: 'void mgRemoveEdge(',
  removeEdgeWrite: 'g->matrix[u][v] = 0;',
  dfsFn: 'void dfs(MatrixGraph *g, int u) {',
  dfsVisit: 'visited[u] = 1;',
  dfsPrint: 'printf("%d ", u);',
  dfsLoop: 'if (g->matrix[u][v] && !visited[v]) {',
  dfsRecur: 'dfs(g, v);',
  bfsFn: 'void bfs(MatrixGraph *g, int start) {',
  bfsEnq: 'queue[rear++] = start;',
  bfsOut: 'int u = queue[front++];',
  bfsMark: 'visited[v] = 1;',
  bfsEnqV: 'queue[rear++] = v;',
});""")
repl('src/core/data-structures/graph.ts', [
    ('    codeLine: 8,\n    highlight: labels,', '    codeLine: L.addEdgeWrite,\n    highlight: labels,'),
    ('    codeLine: 15,', '    codeLine: L.addEdgeWrite,'),
    ('    codeLine: 21,', '    codeLine: L.removeEdgeWrite,'),
    ('    codeLine: 45,', '    codeLine: L.dfsFn,'),
    ('      codeLine: 46,', '      codeLine: L.dfsVisit,'),
    ('          codeLine: 50,', '          codeLine: L.dfsLoop,'),
    ('        codeLine: 51,', '        codeLine: L.dfsRecur,'),
    ('      codeLine: 52,', '      codeLine: L.dfsLoop,'),
    ('    codeLine: 48,', '    codeLine: L.dfsPrint,'),
    ('    codeLine: 55,', '    codeLine: L.bfsFn,'),
    ('      codeLine: 60,', '      codeLine: L.bfsOut,'),
    ('          codeLine: 64,', '          codeLine: L.dfsLoop,'),
    ('        codeLine: 65,', '        codeLine: L.bfsEnqV,'),
    ('    codeLine: 62,', '    codeLine: L.bfsMark,'),
])
print('graph done')
