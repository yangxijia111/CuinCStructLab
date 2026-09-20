/**
 * 二叉搜索树 BST：insert / search / delete（三情形）（DATA_STRUCTURE_SPEC §6）。
 * 约定：左子树 < 根 < 右子树；重复值不插入；删除双子节点用"中序前驱"（左子树最大）。
 */
import { SimMem, StepRecorder, otherVar, ptrVar } from '../recorder';
import type { TreeNodeV, TreeState, Step, VizOutcome } from '../types';

/** 教学 C 代码（Step.codeLine 指向这里，1-based） */
export const BST_C_CODE: string[] = [
  '/* 二叉搜索树 BST：左子树所有值 < 根 < 右子树所有值 */',
  '#include <stdio.h>',
  '#include <stdlib.h>',
  '',
  'typedef struct TreeNode {',
  '    int data;',
  '    struct TreeNode *left;',
  '    struct TreeNode *right;',
  '} TreeNode;',
  '',
  '/* 插入：小的往左，大的往右，相等忽略（不存重复值） */',
  'TreeNode *bstInsert(TreeNode *root, int value) {',
  '    if (root == NULL) {',
  '        TreeNode *node = (TreeNode *)malloc(sizeof(TreeNode));',
  '        if (node == NULL) {',
  '            return NULL;',
  '        }',
  '        node->data = value;',
  '        node->left = NULL;',
  '        node->right = NULL;',
  '        return node;                 /* 空位就是新节点的家 */',
  '    }',
  '    if (value < root->data) {',
  '        root->left = bstInsert(root->left, value);',
  '    } else if (value > root->data) {',
  '        root->right = bstInsert(root->right, value);',
  '    }',
  '    return root;',
  '}',
  '',
  '/* 查找：每比较一次排除一半（前提：确实是 BST） */',
  'TreeNode *bstSearch(TreeNode *root, int value) {',
  '    if (root == NULL) {',
  '        return NULL;                 /* 走到空位 = 不存在 */',
  '    }',
  '    if (value == root->data) {',
  '        return root;                 /* 找到 */',
  '    }',
  '    if (value < root->data) {',
  '        return bstSearch(root->left, value);',
  '    }',
  '    return bstSearch(root->right, value);',
  '}',
  '',
  '/* 删除：三种情形 */',
  'TreeNode *bstDelete(TreeNode *root, int value) {',
  '    if (root == NULL) {',
  '        return NULL;',
  '    }',
  '    if (value < root->data) {',
  '        root->left = bstDelete(root->left, value);',
  '    } else if (value > root->data) {',
  '        root->right = bstDelete(root->right, value);',
  '    } else {',
  '        /* 找到目标节点 root，分三种情形处理 */',
  '        if (root->left == NULL && root->right == NULL) {',
  '            /* 情形一：叶节点，直接删除 */',
  '            free(root);',
  '            return NULL;',
  '        }',
  '        if (root->left == NULL) {',
  '            /* 情形二：只有右孩子，右孩子顶替自己 */',
  '            TreeNode *child = root->right;',
  '            free(root);',
  '            return child;',
  '        }',
  '        if (root->right == NULL) {',
  '            /* 情形二：只有左孩子，左孩子顶替自己 */',
  '            TreeNode *child = root->left;',
  '            free(root);',
  '            return child;',
  '        }',
  '        /* 情形三：两个孩子都在。',
  '           策略：找左子树里最大的节点（中序前驱），',
  '           把它的值复制上来，再去左子树删掉那个前驱 */',
  '        TreeNode *prev = root->left;',
  '        while (prev->right != NULL) {',
  '            prev = prev->right;',
  '        }',
  '        root->data = prev->data;     /* 值顶替（节点不动） */',
  '        root->left = bstDelete(root->left, prev->data);',
  '        return root;',
  '    }',
  '    return root;',
  '}',
];

/* ============ 构造 ============ */

export function emptyBST(): TreeState {
  return {
    kind: 'tree',
    nodes: {},
    root: null,
    pointers: [],
    visitOrder: [],
    visitValues: [],
    nextAddr: 0x8000,
    seq: 1,
  };
}

/** 按插入顺序建树（走 bstInsert 逻辑，但压缩为一步；Playground 用） */
export function bstFrom(values: number[]): VizOutcome<TreeState> {
  let state = emptyBST();
  for (const v of values) {
    state = applyInsert(state, v);
  }
  const rec = new StepRecorder<TreeState>(state);
  const mem = bstMem(state);
  rec.record({
    type: 'create',
    title: `按序插入 [${values.join(', ')}] 建成 BST`,
    description: '同样的值按不同顺序插入，会得到不同形状的 BST（但中序遍历结果相同）。',
    codeLine: 13,
    memory: mem.snapshot(),
    highlight: Object.keys(state.nodes),
  });
  return rec.finish();
}

/** 纯插入逻辑（无步骤），供 bstFrom 使用 */
function applyInsert(state: TreeState, value: number): TreeState {
  const s = structuredClone(state);
  const id = `t${s.seq}`;
  s.seq += 1;
  const node = { id, value, left: null as string | null, right: null as string | null };
  s.nodes[id] = node;
  if (s.root === null) {
    s.root = id;
    return s;
  }
  let cur = s.root;
  for (;;) {
    const curNode = s.nodes[cur]!;
    if (value < curNode.value) {
      if (curNode.left === null) {
        curNode.left = id;
        break;
      }
      cur = curNode.left;
    } else if (value > curNode.value) {
      if (curNode.right === null) {
        curNode.right = id;
        break;
      }
      cur = curNode.right;
    } else {
      // 重复值：丢弃刚创建的节点
      delete s.nodes[id];
      s.seq -= 1;
      break;
    }
  }
  return s;
}

/** BST 中序序列（用于验证性质） */
export function bstInorder(state: TreeState): number[] {
  const out: number[] = [];
  function walk(id: string | null): void {
    if (id === null) return;
    const node = state.nodes[id];
    if (node === undefined) return;
    walk(node.left);
    out.push(node.value);
    walk(node.right);
  }
  walk(state.root);
  return out;
}

function bstMem(state: TreeState): SimMem {
  const mem = new SimMem(state.nextAddr);
  for (const n of Object.values(state.nodes)) {
    if (n.freed) continue;
    mem.allocObject(
      n.id,
      `Node(${n.value})`,
      `data=${n.value}, left=${n.left === null ? 'NULL' : String(state.nodes[n.left]?.value ?? '?')}, right=${n.right === null ? 'NULL' : String(state.nodes[n.right]?.value ?? '?')}`,
      'TreeNode',
    );
  }
  mem.defineVar('root', state.root === null ? null : mem.addrOf(state.root), 'TreeNode*');
  return mem;
}

/* ============ 插入（含步骤） ============ */

export function bstInsert(state: TreeState, value: number): VizOutcome<TreeState> {
  const rec = new StepRecorder<TreeState>(state);
  const mem = bstMem(state);

  if (state.root === null) {
    const id = `t${state.seq}`;
    const addr = mem.allocObject(id, `Node(${value})`, `data=${value}, left=NULL, right=NULL`, 'TreeNode');
    rec.record({
      type: 'create',
      title: `树是空的：newNode(${value}) 直接成为根`,
      description: `root == NULL，malloc 新节点作为根。地址 ${addr}（模拟）。`,
      codeLine: 14,
      variables: [ptrVar('root', addr, id), otherVar('value', String(value))],
      memory: mem.snapshot(),
      highlight: [id],
      mutate: (s) => {
        s.seq += 1;
        s.nodes[id] = { id, value, left: null, right: null };
        s.root = id;
        s.nextAddr = mem.heapTop;
      },
    });
    return rec.finish();
  }

  let curId: string | null = state.root;
  let parentId: string | null = null;
  let parentSide: 'left' | 'right' = 'left';
  for (;;) {
    if (curId === null) {
      // 找到空位：插入
      const id = `t${rec.state.seq}`;
      const addr = mem.allocObject(id, `Node(${value})`, `data=${value}, left=NULL, right=NULL`, 'TreeNode');
      rec.record({
        type: 'create',
        title: `root == NULL：malloc 新节点（${value}），接上父指针`,
        description: `走到空位，这里就是 ${value} 的位置。地址 ${addr}（模拟）。`,
        beginnerNote: `插入总是发生在叶子层：一路比较下来最后撞到 NULL，把新节点挂在这个 NULL 上。父节点的 ${parentSide} 指针改指新节点。`,
        codeLine: 14,
        variables: [otherVar('value', String(value)), ptrVar('新节点', addr, id)],
        memory: mem.snapshot(),
        highlight: [id],
        mutate: (s) => {
          s.seq += 1;
          s.nodes[id] = { id, value, left: null, right: null };
          // 注意：必须在 draft（克隆后的新状态）里按 id 重新定位父节点
          if (parentId !== null) {
            const parent = s.nodes[parentId]!;
            if (parentSide === 'left') parent.left = id;
            else parent.right = id;
          }
          s.nextAddr = mem.heapTop;
        },
      });
      return rec.finish();
    }
    const curNode: TreeNodeV = rec.state.nodes[curId]!;
    if (value < curNode.value) {
      rec.record({
        type: 'compare',
        title: `${value} < ${curNode.value}：往左子树走`,
        description: `BST 性质：比当前节点小的值只可能在左子树。`,
        codeLine: 25,
        variables: [otherVar('value', String(value)), ptrVar('root', mem.addrOf(curId), curId)],
        memory: mem.snapshot(),
        highlight: [curId, curNode.left ?? ''].filter(Boolean),
        mutate: (s) => {
          s.pointers = [{ name: 'root', target: curId }];
        },
      });
      parentId = curId;
      parentSide = 'left';
      curId = curNode.left;
    } else if (value > curNode.value) {
      rec.record({
        type: 'compare',
        title: `${value} > ${curNode.value}：往右子树走`,
        description: `比当前节点大的值只可能在右子树。`,
        codeLine: 27,
        variables: [otherVar('value', String(value)), ptrVar('root', mem.addrOf(curId), curId)],
        memory: mem.snapshot(),
        highlight: [curId, curNode.right ?? ''].filter(Boolean),
        mutate: (s) => {
          s.pointers = [{ name: 'root', target: curId }];
        },
      });
      parentId = curId;
      parentSide = 'right';
      curId = curNode.right;
    } else {
      rec.record({
        type: 'info',
        title: `${value} == ${curNode.value}：已存在，不插入重复值`,
        description: '本实现约定 BST 不存重复值，直接返回。',
        codeLine: 29,
        variables: [otherVar('value', String(value))],
        memory: mem.snapshot(),
        highlight: [curId],
      });
      return rec.finish();
    }
  }
}

/* ============ 查找 ============ */

export function bstSearch(state: TreeState, value: number): VizOutcome<TreeState> {
  const rec = new StepRecorder<TreeState>(state);
  const mem = bstMem(state);

  let curId = state.root;
  while (curId !== null) {
    const node = rec.state.nodes[curId]!;
    if (value === node.value) {
      rec.record({
        type: 'visit',
        title: `value == root->data：找到了 ${value}`,
        description: '查找成功。每次比较都排除一整棵子树，这是 BST 高效的来源。',
        codeLine: 40,
        variables: [otherVar('value', String(value)), ptrVar('root', mem.addrOf(curId), curId)],
        memory: mem.snapshot(),
        highlight: [curId],
        mutate: (s) => {
          s.pointers = [{ name: 'root', target: curId }];
        },
      });
      return rec.finish();
    }
    const goLeft = value < node.value;
    rec.record({
      type: 'compare',
      title: goLeft ? `${value} < ${node.value}：去左子树找` : `${value} > ${node.value}：去右子树找`,
      description: goLeft
        ? '目标更小，只可能在左子树，右子树整棵被排除。'
        : '目标更大，只可能在右子树，左子树整棵被排除。',
      codeLine: goLeft ? 44 : 46,
      variables: [otherVar('value', String(value)), ptrVar('root', mem.addrOf(curId), curId)],
      memory: mem.snapshot(),
      highlight: [curId],
      mutate: (s) => {
        s.pointers = [{ name: 'root', target: curId }];
      },
    });
    curId = goLeft ? node.left : node.right;
  }

  rec.record({
    type: 'info',
    title: `root == NULL：${value} 不在这棵树里`,
    description: '走到空位还没找到，查找失败。BST 查找失败同样高效：一路被"引导"到唯一可能的位置。',
    codeLine: 37,
    variables: [otherVar('value', String(value)), ptrVar('root', null)],
    memory: mem.snapshot(),
    mutate: (s) => {
      s.pointers = [];
    },
  });
  return rec.finish();
}

/* ============ 删除（三情形） ============ */

export function bstDelete(state: TreeState, value: number): VizOutcome<TreeState> {
  const rec = new StepRecorder<TreeState>(state);
  const mem = bstMem(state);

  // 1. 定位目标及其父节点
  let parent: string | null = null;
  let curId = state.root;
  let side: 'left' | 'right' | 'root' = 'root';

  while (curId !== null) {
    const node = rec.state.nodes[curId]!;
    if (value === node.value) break;
    const goLeft = value < node.value;
    rec.record({
      type: 'compare',
      title: goLeft ? `${value} < ${node.value}：目标若存在，在左子树` : `${value} > ${node.value}：目标若存在，在右子树`,
      description: '先定位要删除的节点，思路与查找一致。',
      codeLine: goLeft ? 54 : 56,
      variables: [otherVar('value', String(value)), ptrVar('root', mem.addrOf(curId), curId)],
      memory: mem.snapshot(),
      highlight: [curId],
      mutate: (s) => {
        s.pointers = [{ name: 'root', target: curId }];
      },
    });
    parent = curId;
    side = goLeft ? 'left' : 'right';
    curId = goLeft ? node.left : node.right;
  }

  if (curId === null) {
    rec.fail('没找到', `树中不存在值为 ${value} 的节点，删除失败。`, 52);
    return rec.finish();
  }

  const target = rec.state.nodes[curId]!;
  rec.record({
    type: 'visit',
    title: `找到目标 ${value}（左孩子${target.left === null ? '无' : `=${rec.state.nodes[target.left]?.value}`}，右孩子${target.right === null ? '无' : `=${rec.state.nodes[target.right]?.value}`}）`,
    description: '接下来按子节点个数分三种情形处理。',
    codeLine: 59,
    variables: [ptrVar('target', mem.addrOf(curId), curId)],
    memory: mem.snapshot(),
    highlight: [curId],
  });

  // 情形一：叶节点
  if (target.left === null && target.right === null) {
    rec.record({
      type: 'info',
      title: '情形一：叶节点（左右都是 NULL）',
      description: '最简单：把父节点指向它的指针置 NULL，再 free。',
      codeLine: 61,
      memory: mem.snapshot(),
      highlight: [curId],
    });
    mem.freeObject(curId);
    rec.record({
      type: 'delete',
      title: `父指针置 NULL，free(${value})`,
      description: `叶节点没有任何孩子需要接管。删除后树仍满足 BST 性质。`,
      codeLine: 63,
      memory: mem.snapshot(),
      highlight: [curId],
      mutate: (s) => {
        if (side === 'root') {
          s.root = null;
        } else if (parent !== null) {
          const p = s.nodes[parent]!;
          if (side === 'left') p.left = null;
          else p.right = null;
        }
        delete s.nodes[curId];
        s.pointers = [];
      },
    });
    return rec.finish();
  }

  // 情形二：单孩子
  if (target.left === null || target.right === null) {
    const child = target.left ?? target.right;
    const childValue = child !== null ? (rec.state.nodes[child]?.value ?? '?') : '?';
    rec.record({
      type: 'info',
      title: `情形二：只有一个孩子（${childValue}）`,
      description: `让唯一的孩子"顶替"自己：父指针直接跨过目标指向孙子。BST 性质不受影响（整棵子树一起搬）。`,
      beginnerNote: '被删节点的子树整体性质不变，挂到祖父下面依然有序——就像排队时中间人走了，后面的人整体上前一步。',
      codeLine: target.left === null ? 67 : 72,
      memory: mem.snapshot(),
      highlight: [curId, child ?? ''].filter(Boolean),
    });
    mem.freeObject(curId);
    rec.record({
      type: 'delete',
      title: `父指针改指 ${childValue}，free(${value})`,
      description: '绕过目标完成删除。',
      codeLine: target.left === null ? 69 : 74,
      memory: mem.snapshot(),
      highlight: [child ?? ''],
      mutate: (s) => {
        if (side === 'root') {
          s.root = child;
        } else if (parent !== null) {
          const p = s.nodes[parent]!;
          if (side === 'left') p.left = child;
          else p.right = child;
        }
        delete s.nodes[curId];
        s.pointers = [];
      },
    });
    return rec.finish();
  }

  // 情形三：双子节点，用中序前驱（左子树最大）
  const leftChild = target.left;
  const rightChild = target.right;
  rec.record({
    type: 'info',
    title: '情形三：两个孩子都在，不能简单绕过',
    description: '两个孩子都要保留。策略：用"中序前驱"（左子树里最大的节点）的值顶替目标值，再去左子树里删掉那个前驱（它最多只有左孩子，退化为情形一/二）。',
    beginnerNote: '也可以用中序后继（右子树最小）。两种都正确，本平台采用前驱方案：一直向右走到底就是左子树的最大值。',
    codeLine: 77,
    memory: mem.snapshot(),
    highlight: [curId, leftChild, rightChild],
  });

  // 找左子树最大
  let prevId = leftChild;
  while (rec.state.nodes[prevId]!.right !== null) {
    prevId = rec.state.nodes[prevId]!.right as string;
  }
  const prevValue = rec.state.nodes[prevId]!.value;
  rec.record({
    type: 'move',
    title: `从左孩子 ${rec.state.nodes[leftChild]!.value} 一路向右走到底：中序前驱是 ${prevValue}`,
    description: `左子树的最右下角节点就是整棵树中小于 ${value} 的最大值。`,
    codeLine: 81,
    memory: mem.snapshot(),
    highlight: [prevId],
    mutate: (s) => {
      s.pointers = [{ name: 'prev', target: prevId }];
    },
  });

  rec.record({
    type: 'assign',
    title: `root->data = prev->data：${value} → ${prevValue}（只复制值，节点不动）`,
    description: '把前驱的值写到目标节点上。此时树里出现两个相同值，接下来删除左子树里的那个。',
    codeLine: 84,
    memory: mem.snapshot(),
    highlight: [curId, prevId],
    mutate: (s) => {
      s.nodes[curId]!.value = prevValue;
    },
  });

  rec.record({
    type: 'delete',
    title: `再对左子树执行 bstDelete(左子树根, ${prevValue})，删掉多余的前驱`,
    description: `前驱节点最多只有一个（左）孩子，这次删除一定落在情形一或情形二。递归完成后整棵树仍是 BST。`,
    codeLine: 85,
    memory: mem.snapshot(),
    highlight: [prevId],
    mutate: (s) => {
      // 在左子树中删除 prevValue（纯逻辑，与 bstDelete 相同的三情形）
      const after = deletePure(s, prevValue);
      Object.assign(s, after);
      s.pointers = [];
    },
  });

  return rec.finish();
}

/** 纯删除逻辑（无步骤）：情形三的收尾用 */
function deletePure(state: TreeState, value: number): TreeState {
  const s = structuredClone(state);
  let parent: string | null = null;
  let cur = s.root;
  let side: 'left' | 'right' | 'root' = 'root';
  while (cur !== null) {
    const node = s.nodes[cur]!;
    if (value === node.value) break;
    const goLeft = value < node.value;
    parent = cur;
    side = goLeft ? 'left' : 'right';
    cur = goLeft ? node.left : node.right;
  }
  if (cur === null) return s;
  const target = s.nodes[cur]!;
  const replace = (rep: string | null): void => {
    if (side === 'root') s.root = rep;
    else if (parent !== null) {
      const p = s.nodes[parent]!;
      if (side === 'left') p.left = rep;
      else p.right = rep;
    }
  };
  if (target.left === null && target.right === null) {
    replace(null);
    delete s.nodes[cur];
  } else if (target.left === null || target.right === null) {
    const child = target.left ?? target.right;
    replace(child);
    delete s.nodes[cur];
  } else {
    // 前驱 = 左子树最右节点
    let prevParent: string | null = null; // prev 的父节点（null 表示 prev 就是 target.left）
    let prevId = target.left as string;
    while (s.nodes[prevId]!.right !== null) {
      prevParent = prevId;
      prevId = s.nodes[prevId]!.right as string;
    }
    const prevValue = s.nodes[prevId]!.value;
    target.value = prevValue;
    // 前驱没有右孩子，只需用它的左孩子顶替它
    const rep = s.nodes[prevId]!.left;
    if (prevParent === null) {
      // 前驱就是 target 的左孩子本身
      target.left = rep;
    } else {
      s.nodes[prevParent]!.right = rep;
    }
    delete s.nodes[prevId];
  }
  return s;
}

export type BSTStep = Step<TreeState>;
