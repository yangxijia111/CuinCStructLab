/**
 * 二叉树：定义与四种遍历（DATA_STRUCTURE_SPEC §6）。
 * 教学重点：递归遍历时同步展示 Call Stack 压栈/出栈；层序遍历展示队列。
 */
import { SimMem, StepRecorder } from '../recorder';
import type { CallFrame, TreeState, Step, VizOutcome } from '../types';
import { buildLineMap } from '../utils/code-lines';

/** 教学 C 代码（Step.codeLine 指向这里，1-based） */
export const TREE_C_CODE: string[] = [
  '/* 二叉树：定义与四种遍历 */',
  '#include <stdio.h>',
  '#include <stdlib.h>',
  '',
  'typedef struct TreeNode {',
  '    int data;',
  '    struct TreeNode *left;    /* 左孩子指针 */',
  '    struct TreeNode *right;   /* 右孩子指针 */',
  '} TreeNode;',
  '',
  '/* 手工创建一个节点 */',
  'TreeNode *newNode(int value) {',
  '    TreeNode *node = (TreeNode *)malloc(sizeof(TreeNode));',
  '    if (node == NULL) {',
  '        return NULL;',
  '    }',
  '    node->data = value;',
  '    node->left = NULL;',
  '    node->right = NULL;',
  '    return node;',
  '}',
  '',
  '/* 先序遍历：根 → 左 → 右 */',
  'void preorder(TreeNode *node) {',
  '    if (node == NULL) {',
  '        return;                 /* 递归出口：空树直接返回 */',
  '    }',
  '    printf("%d ", node->data);  /* ① 先访问根 */',
  '    preorder(node->left);       /* ② 再递归左子树 */',
  '    preorder(node->right);      /* ③ 最后递归右子树 */',
  '}',
  '',
  '/* 中序遍历：左 → 根 → 右（对 BST 结果有序） */',
  'void inorder(TreeNode *node) {',
  '    if (node == NULL) {',
  '        return;',
  '    }',
  '    inorder(node->left);        /* ① 先走左 */',
  '    printf("%d ", node->data);  /* ② 输出根 */',
  '    inorder(node->right);       /* ③ 再走右 */',
  '}',
  '',
  '/* 后序遍历：左 → 右 → 根（销毁树必须用后序：先释放孩子） */',
  'void postorder(TreeNode *node) {',
  '    if (node == NULL) {',
  '        return;',
  '    }',
  '    postorder(node->left);      /* ① 左 */',
  '    postorder(node->right);     /* ② 右 */',
  '    printf("%d ", node->data);  /* ③ 根 */',
  '}',
  '',
  '/* 层序遍历：借助队列，一层一层从左到右 */',
  'void levelOrder(TreeNode *root) {',
  '    if (root == NULL) {',
  '        return;',
  '    }',
  '    TreeNode *queue[100];',
  '    int front = 0, rear = 0;',
  '    queue[rear++] = root;               /* 根节点入队 */',
  '    while (front < rear) {',
  '        TreeNode *node = queue[front++];  /* 出队并访问 */',
  '        printf("%d ", node->data);',
  '        if (node->left != NULL) {',
  '            queue[rear++] = node->left;   /* 左孩子入队 */',
  '        }',
  '        if (node->right != NULL) {',
  '            queue[rear++] = node->right;  /* 右孩子入队 */',
  '        }',
  '    }',
  '}',
  '',
  '/* 销毁：后序释放全部节点 */',
  'void destroyTree(TreeNode *node) {',
  '    if (node == NULL) {',
  '        return;',
  '    }',
  '    destroyTree(node->left);',
  '    destroyTree(node->right);',
  '    free(node);',
  '}',
];

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
});

/* ============ 构造 ============ */

/** 从层序数组构建（null 表示空位；下标 i 的孩子是 2i+1 / 2i+2，教学用 0-based） */
export function treeFromArray(values: Array<number | null>): TreeState {
  const nodes: TreeState['nodes'] = {};
  const ids: Array<string | null> = values.map((v, i) => (v === null ? null : `t${i}`));
  for (const [i, v] of values.entries()) {
    if (v === null) continue;
    const left = ids[2 * i + 1] ?? null;
    const right = ids[2 * i + 2] ?? null;
    nodes[`t${i}`] = { id: `t${i}`, value: v, left, right };
  }
  return {
    kind: 'tree',
    nodes,
    root: ids[0] ?? null,
    pointers: [],
    visitOrder: [],
    visitValues: [],
    nextAddr: 0x8000,
    seq: values.length,
  };
}

export function treeFrom(values: Array<number | null>): VizOutcome<TreeState> {
  const rec = new StepRecorder<TreeState>(treeFromArray(values));
  const mem = treeMem(rec.state);
  rec.record({
    type: 'create',
    title: '构建二叉树完成',
    description: `共 ${Object.keys(rec.state.nodes).length} 个节点。每个节点含 data、left、right 三个域。`,
    beginnerNote:
      '二叉树的"左右"是有顺序的：left 必须挂在左边。空位用 NULL 表示，叶子节点左右都是 NULL。',
    codeLine: L.newNodeMalloc,
    memory: mem.snapshot(),
    highlight: Object.keys(rec.state.nodes),
  });
  return rec.finish();
}

export function treeValues(state: TreeState): number[] {
  return Object.values(state.nodes).map((n) => n.value);
}

function treeMem(state: TreeState): SimMem {
  const mem = new SimMem(state.nextAddr);
  for (const n of Object.values(state.nodes)) {
    if (n.freed) continue;
    const left = n.left === null ? 'NULL' : '节点';
    const right = n.right === null ? 'NULL' : '节点';
    mem.allocObject(n.id, `Node(${n.value})`, `data=${n.value}, left=${left}, right=${right}`, 'TreeNode');
  }
  mem.defineVar('root', state.root === null ? null : mem.addrOf(state.root), 'TreeNode*');
  return mem;
}

/* ============ 递归遍历（含调用栈） ============ */

export type TraversalOrder = 'preorder' | 'inorder' | 'postorder';

export function treeTraverse(state: TreeState, order: TraversalOrder): VizOutcome<TreeState> {
  const rec = new StepRecorder<TreeState>(state);
  const mem = treeMem(state);
  const actions = traverseActionSequence(order);
  const orderName = order === 'preorder' ? '先序' : order === 'inorder' ? '中序' : '后序';
  const orderDesc =
    order === 'preorder' ? '根 → 左 → 右' : order === 'inorder' ? '左 → 根 → 右' : '左 → 右 → 根';
  const entryLine = order === 'preorder' ? L.preFn : order === 'inorder' ? L.inFn : L.postFn;
  const nullLine = order === 'preorder' ? L.preNull : order === 'inorder' ? L.inNull : L.postNull;
  const visitLine = order === 'preorder' ? L.prePrint : order === 'inorder' ? L.inPrint : L.postPrint;
  const leftLine = order === 'preorder' ? L.preLeft : order === 'inorder' ? L.inLeft : L.postLeft;
  const rightLine = order === 'preorder' ? L.preRight : order === 'inorder' ? L.inRight : L.postRight;

  rec.record({
    type: 'init',
    title: `开始${orderName}遍历（${orderDesc}）`,
    description: `${orderName}遍历以"根"被访问的位置命名。整个递归过程会同步展示调用栈的压栈与出栈。`,
    beginnerNote: `递归三要素：① 递归出口（node == NULL 就返回）② 本层做什么 ③ 如何缩小问题（走向孩子）。三种遍历的代码几乎一样，只是 printf 的位置不同。`,
    codeLine: entryLine,
    memory: mem.snapshot(),
    callStack: [],
    mutate: (s) => {
      s.visitOrder = [];
      s.visitValues = [];
    },
  });

  const stack: CallFrame[] = [];

  function walk(nodeId: string | null): void {
    if (nodeId === null) {
      rec.record({
        type: 'return',
        title: 'node == NULL：到达递归出口，直接 return',
        description: '空子树不需要处理，这一层立即返回到调用者。',
        codeLine: nullLine,
        memory: mem.snapshot(),
        callStack: [...stack],
      });
      return;
    }
    const node = rec.state.nodes[nodeId]!;
    stack.push({ fn: `${order}(node=${node.value})`, detail: `处理以 ${node.value} 为根的子树` });
    rec.record({
      type: 'call',
      title: `${order}(node = ${node.value})：函数调用，压入调用栈（深度 ${stack.length}）`,
      description: `进入以 ${node.value} 为根的子树。`,
      beginnerNote: `每调用一次函数，系统就在调用栈上压入一帧（保存参数和返回位置）。当前 node = ${node.value}。递归"深入"的过程就是栈不断长高的过程。`,
      codeLine: entryLine,
      memory: mem.snapshot(),
      callStack: [...stack],
      highlight: [nodeId],
      mutate: (s) => {
        s.pointers = [{ name: 'node', target: nodeId }];
      },
    });

    for (const act of actions) {
      if (act === 'visit') {
        const visited = [...(rec.state.visitValues ?? []), node.value];
        rec.record({
          type: 'visit',
          title: `printf("%d ", node->data)：输出 ${node.value}`,
          description: `${orderName}输出序列：${visited.join(' ')}`,
          codeLine: visitLine,
          memory: mem.snapshot(),
          callStack: [...stack],
          highlight: [nodeId],
          mutate: (s) => {
            s.visitOrder = [...(s.visitOrder ?? []), nodeId];
            s.visitValues = visited;
          },
        });
      } else if (act === 'left') {
        const child = node.left;
        rec.record({
          type: 'move',
          title: `${order}(node->left)${child === null ? '（NULL）' : `：进入左孩子 ${rec.state.nodes[child]?.value}`}`,
          description: `递归处理 ${node.value} 的左子树。`,
          codeLine: leftLine,
          memory: mem.snapshot(),
          callStack: [...stack],
          highlight: child === null ? [] : [child],
        });
        walk(child);
      } else {
        const child = node.right;
        rec.record({
          type: 'move',
          title: `${order}(node->right)${child === null ? '（NULL）' : `：进入右孩子 ${rec.state.nodes[child]?.value}`}`,
          description: `递归处理 ${node.value} 的右子树。`,
          codeLine: rightLine,
          memory: mem.snapshot(),
          callStack: [...stack],
          highlight: child === null ? [] : [child],
        });
        walk(child);
      }
    }

    stack.pop();
    rec.record({
      type: 'return',
      title: `${order}(${node.value}) 返回：弹出调用栈（深度 ${stack.length}）`,
      description: `以 ${node.value} 为根的子树处理完毕，回到调用者继续执行下一条语句。`,
      beginnerNote: '函数返回时，它那一帧自动出栈，回到调用者的下一条语句继续执行。递归"回升"的过程就是栈不断变矮的过程。',
      codeLine: rightLine,
      memory: mem.snapshot(),
      callStack: [...stack],
      highlight: [nodeId],
    });
  }

  walk(state.root);

  rec.record({
    type: 'info',
    title: `${orderName}遍历结束`,
    description: `完整输出：${(rec.state.visitValues ?? []).join(' ')}`,
    codeLine: entryLine,
    memory: mem.snapshot(),
    callStack: [],
  });

  return rec.finish();
}

/** 生成遍历动作序列（'visit' / 'left' / 'right'） */
function traverseActionSequence(order: TraversalOrder): Array<'visit' | 'left' | 'right'> {
  if (order === 'preorder') return ['visit', 'left', 'right'];
  if (order === 'inorder') return ['left', 'visit', 'right'];
  return ['left', 'right', 'visit'];
}

/* ============ 层序遍历 ============ */

export function treeLevelOrder(state: TreeState): VizOutcome<TreeState> {
  const rec = new StepRecorder<TreeState>(state);
  const mem = treeMem(state);

  rec.record({
    type: 'init',
    title: '开始层序遍历（借助队列，一层一层从左到右）',
    description: '层序遍历不是递归，而是用队列：根入队 → 出队访问 → 左右孩子入队 → 循环。',
    beginnerNote: '队列的 FIFO 特性正好保证"先遇到的先处理"，所以同一层的节点总是连续输出。',
    codeLine: L.levelFn,
    memory: mem.snapshot(),
    callStack: [],
    mutate: (s) => {
      s.visitOrder = [];
      s.visitValues = [];
      s.frontier = [];
    },
  });

  if (state.root !== null) {
    rec.record({
      type: 'insert',
      title: 'queue[rear++] = root（根节点入队）',
      description: `根 ${rec.state.nodes[state.root]?.value} 入队。`,
      codeLine: L.levelRoot,
      memory: mem.snapshot(),
      highlight: [state.root],
      mutate: (s) => {
        s.frontier = [state.root as string];
      },
    });
  }

  for (;;) {
    const frontier = rec.state.frontier ?? [];
    if (frontier.length === 0) break;
    const nodeId = frontier[0]!;
    const node = rec.state.nodes[nodeId]!;
    const rest = frontier.slice(1);
    const visitedNow = [...(rec.state.visitValues ?? []), node.value];

    rec.record({
      type: 'visit',
      title: `node = queue[front++]：出队并输出 ${node.value}`,
      description: `访问 ${node.value}。输出序列：${visitedNow.join(' ')}。队列：[${rest.map((id) => rec.state.nodes[id]?.value).join(', ')}]`,
      codeLine: L.levelOut,
      memory: mem.snapshot(),
      highlight: [nodeId],
      callStack: [],
      mutate: (s) => {
        s.frontier = rest;
        s.visitOrder = [...(s.visitOrder ?? []), nodeId];
        s.visitValues = visitedNow;
        s.pointers = [{ name: 'node', target: nodeId }];
      },
    });

    const enq: string[] = [];
    if (node.left !== null) {
      enq.push(node.left);
      rec.record({
        type: 'insert',
        title: `queue[rear++] = node->left（${rec.state.nodes[node.left]?.value} 入队）`,
        description: `${node.value} 的左孩子 ${rec.state.nodes[node.left]?.value} 排到队尾。`,
        codeLine: L.levelLeft,
        memory: mem.snapshot(),
        highlight: [node.left],
        callStack: [],
        mutate: (s) => {
          s.frontier = [...(s.frontier ?? []), node.left as string];
        },
      });
    }
    if (node.right !== null) {
      enq.push(node.right);
      rec.record({
        type: 'insert',
        title: `queue[rear++] = node->right（${rec.state.nodes[node.right]?.value} 入队）`,
        description: `${node.value} 的右孩子 ${rec.state.nodes[node.right]?.value} 排到队尾。`,
        codeLine: L.levelRight,
        memory: mem.snapshot(),
        highlight: [node.right],
        callStack: [],
        mutate: (s) => {
          s.frontier = [...(s.frontier ?? []), node.right as string];
        },
      });
    }
    void enq;
  }

  rec.record({
    type: 'info',
    title: 'front == rear：队列空，层序遍历结束',
    description: `完整输出：${(rec.state.visitValues ?? []).join(' ')}`,
    codeLine: L.levelWhile,
    memory: mem.snapshot(),
    callStack: [],
  });

  return rec.finish();
}

/* ============ 销毁 ============ */

export function treeDestroy(state: TreeState): VizOutcome<TreeState> {
  const rec = new StepRecorder<TreeState>(state);
  const mem = treeMem(state);
  const stack: CallFrame[] = [];

  function walk(nodeId: string | null): void {
    if (nodeId === null) return;
    const node = rec.state.nodes[nodeId]!;
    stack.push({ fn: `destroy(${node.value})` });
    rec.record({
      type: 'call',
      title: `destroyTree(${node.value})`,
      description: '后序销毁：必须先释放两个孩子，最后才能释放自己，否则孩子就找不到了。',
      codeLine: L.destroyFn,
      memory: mem.snapshot(),
      callStack: [...stack],
      highlight: [nodeId],
    });
    walk(node.left);
    walk(node.right);
    mem.freeObject(nodeId);
    stack.pop();
    rec.record({
      type: 'free',
      title: `free(node)：释放 ${node.value}`,
      description: `左右子树已释放完毕，现在释放 ${node.value} 自己。`,
      codeLine: L.destroyFree,
      memory: mem.snapshot(),
      callStack: [...stack],
      highlight: [nodeId],
      mutate: (s) => {
        const n = s.nodes[nodeId];
        if (n !== undefined) n.freed = true;
      },
    });
  }

  walk(state.root);
  rec.record({
    type: 'info',
    title: '销毁完成',
    description: '全部节点已按后序释放，无泄漏。',
    codeLine: L.destroyFree,
    memory: mem.snapshot(),
    mutate: (s) => {
      s.root = null;
    },
  });
  return rec.finish();
}

export type TreeStep = Step<TreeState>;
