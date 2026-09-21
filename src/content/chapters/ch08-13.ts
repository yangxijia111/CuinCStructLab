/**
 * Chapter 8~13：树 / BST / 堆 / 图 / 查找 / 排序。
 */
import type { Chapter, CProgramRef } from '../types';
import { TREE_C_CODE } from '../../core/data-structures/tree';
import { BST_C_CODE } from '../../core/data-structures/bst';
import { HEAP_C_CODE } from '../../core/data-structures/heap';
import { GRAPH_C_CODE } from '../../core/data-structures/graph';
import { SEARCH_C_CODE } from '../../core/algorithms/search';
import {
  BUBBLE_C_CODE,
  INSERTION_C_CODE,
  MERGE_C_CODE,
  QUICK_C_CODE,
  SELECTION_C_CODE,
  SHELL_C_CODE,
  HEAPSORT_C_CODE,
} from '../../core/algorithms/sorting-codes';

export const CH08_C_PROGRAMS: CProgramRef[] = [
  { id: 'tree', title: '二叉树：定义与四种遍历', lines: TREE_C_CODE },
];
export const CH09_C_PROGRAMS: CProgramRef[] = [{ id: 'bst', title: 'BST：插入/查找/删除', lines: BST_C_CODE }];
export const CH10_C_PROGRAMS: CProgramRef[] = [{ id: 'heap', title: '堆：insert/deleteTop/heapify', lines: HEAP_C_CODE }];
export const CH11_C_PROGRAMS: CProgramRef[] = [{ id: 'graph', title: '图：存储与 DFS/BFS', lines: GRAPH_C_CODE }];
export const CH12_C_PROGRAMS: CProgramRef[] = [{ id: 'search', title: '顺序查找与二分查找', lines: SEARCH_C_CODE }];
export const CH13_C_PROGRAMS: CProgramRef[] = [
  { id: 'sort-bubble', title: '冒泡排序', lines: BUBBLE_C_CODE },
  { id: 'sort-selection', title: '选择排序', lines: SELECTION_C_CODE },
  { id: 'sort-insertion', title: '插入排序', lines: INSERTION_C_CODE },
  { id: 'sort-shell', title: '希尔排序', lines: SHELL_C_CODE },
  { id: 'sort-merge', title: '归并排序', lines: MERGE_C_CODE },
  { id: 'sort-quick', title: '快速排序', lines: QUICK_C_CODE },
  { id: 'sort-heap', title: '堆排序', lines: HEAPSORT_C_CODE },
];

const CH08: Chapter = {
  id: 8,
  title: '树与二叉树',
  subtitle: '从线性到层次：递归的天下',
  keywords: ['树', '二叉树', 'TreeNode', '遍历', '先序', '中序', '后序', '层序', '递归', '调用栈'],
  sections: [
    {
      kind: 'what',
      title: '树是什么',
      body: [
        '树是**层次**结构：每个节点有一个父节点（根除外）和若干孩子。二叉树每个节点最多两个孩子（left/right）。',
        '```c',
        'typedef struct TreeNode {',
        '    int data;',
        '    struct TreeNode *left;',
        '    struct TreeNode *right;',
        '} TreeNode;',
        '```',
      ],
    },
    { kind: 'why', title: '为什么需要', bullets: ['文件系统、组织架构、HTML/XML 天然是树。', '有序数据用树结构可以把查找做到平衡/平均 O(log n)、最坏退化 O(n)（下一章 BST）。', '递归定义：树 = 根 + 左子树 + 右子树，代码极简洁。'] },
    { kind: 'analogy', title: '类比：家谱', bullets: ['根 = 祖先；孩子 = 分支；叶子 = 没有后代的人。', '先序/中序/后序 = 三种"报家谱"的顺序。'] },
    {
      kind: 'diagram',
      title: '二叉树图示',
      body: [
        '```',
        '        8            ← 根',
        '       / \\',
        '      3   10         ← 第二层',
        '     / \\',
        '    1   6            ← 叶子层',
        '```',
      ],
      vizOps: [{ op: 'tree-traverse', preset: { order: 'preorder' }, label: '先序遍历动画' }],
    },
    { kind: 'struct', title: '结构定义', codeId: 'tree' },
    {
      kind: 'operations',
      title: '四种遍历',
      bullets: [
        '先序 Preorder：根 → 左 → 右（8 3 1 6 10）',
        '中序 Inorder：左 → 根 → 右（1 3 6 8 10）',
        '后序 Postorder：左 → 右 → 根（1 6 3 10 8）——销毁树必须用后序',
        '层序 Level Order：一层层从左到右（8 3 10 1 6），借助队列',
        '前三种是递归；层序是队列驱动',
      ],
    },
    { kind: 'code', title: '遍历实现（含调用栈展示）', codeId: 'tree' },
    {
      kind: 'animation',
      title: '动画：递归调用栈可视化',
      vizOps: [
        { op: 'tree-traverse', preset: { order: 'preorder' }, label: '先序 + 调用栈' },
        { op: 'tree-traverse', preset: { order: 'inorder' }, label: '中序 + 调用栈' },
        { op: 'tree-traverse', preset: { order: 'postorder' }, label: '后序 + 调用栈' },
        { op: 'tree-level', label: '层序 + 队列' },
      ],
    },
    {
      kind: 'step',
      title: '单步：盯着调用栈看递归',
      body: [
        '先序遍历 8/3/10/1/6 时调用栈的变化：',
        '```',
        'preorder(8)     ← 栈深度 1，输出 8',
        'preorder(3)     ← 栈深度 2，输出 3',
        'preorder(1)     ← 栈深度 3，输出 1',
        'preorder(NULL)  ← 出口，返回',
        'preorder(6)     ← 输出 6 ……',
        '```',
        '递归"深入"= 压栈，"回溯"= 弹栈。三种遍历的代码只差 printf 的位置。',
      ],
    },
    {
      kind: 'time',
      title: '时间复杂度',
      table: {
        headers: ['操作', '复杂度'],
        rows: [
          ['任意遍历', 'O(n)：每个节点恰好访问一次'],
          ['树高 h 的查找类操作', 'O(h)：普通二叉树退化为链表时 h=n'],
        ],
      },
    },
    { kind: 'space', title: '空间复杂度', bullets: ['遍历的递归栈 O(h)；最坏（斜树）O(n)，平衡时 O(log n)。'] },
    {
      kind: 'pitfalls',
      title: '常见错误',
      bullets: [
        '忘记递归出口（node == NULL）→ 无限递归栈溢出。',
        '销毁树用先序：先 free 自己就找不到孩子了（必须后序）。',
        '以为中序有序：普通二叉树中序不一定有序，BST 才是。',
        '层序遍历标记时机错：出队才标记会重复入队。',
      ],
    },
    { kind: 'quiz', title: '小测验', body: ['题库 → 第 8 章：由两种遍历重建树是经典题。'] },
    { kind: 'exercise', title: '编程练习', body: ['代码练习 → p-tree-inorder：实现中序遍历。'] },
  ],
};

const CH09: Chapter = {
  id: 9,
  title: '二叉搜索树 BST',
  subtitle: '左小右大：把二分查找存进结构里',
  keywords: ['BST', '二叉搜索树', '二叉排序树', 'insert', 'search', 'delete', '中序前驱'],
  sections: [
    {
      kind: 'what',
      title: 'BST 是什么',
      body: ['BST 是满足如下性质的二叉树：**左子树所有值 < 根 < 右子树所有值**（每个子树递归满足）。', '中序遍历 BST 得到升序序列。'],
    },
    { kind: 'why', title: '为什么需要', bullets: ['数组二分查找快但不能高效插删；链表插删快但查找慢。BST 两者兼顾：查找/插入/删除平均 O(log n)。', '是数据库索引、C++ map/set 的基础（平衡版本）。'] },
    { kind: 'analogy',      title: '类比：字典的部首检字',
      bullets: ['先看当前页的范围决定往前还是往后翻——BST 每一步比较都在"排除一整棵子树"。'],
    },
    {
      kind: 'diagram',
      title: 'BST 图示',
      body: [
        '```',
        '        8',
        '       / \\',
        '      3   10',
        '     / \\    \\',
        '    1   6    14',
        '```',
        '查找 6：8→3→6，只走 2 步。中序：1 3 6 8 10 14（升序）。',
      ],
      vizOps: [{ op: 'bst-insert', preset: { value: 5 }, label: '插入动画' }],
    },
    { kind: 'struct', title: '结构定义（与二叉树相同）', codeId: 'bst' },
    { kind: 'operations', title: '核心操作', bullets: ['insert：小于往左、大于往右、相等忽略（本实现不存重复）', 'search：同路径查找', 'delete：三情形（见下）'] },
    { kind: 'code', title: '完整实现', codeId: 'bst' },
    {
      kind: 'animation',
      title: '动画：删除三情形',
      vizOps: [
        { op: 'bst-insert', preset: { value: 5 }, label: '插入：一路比较到空位' },
        { op: 'bst-search', preset: { value: 6 }, label: '查找：每步排除一棵子树' },
        { op: 'bst-delete-leaf', label: '删除情形一：叶节点' },
        { op: 'bst-delete-one-child', label: '删除情形二：单孩子顶替' },
        { op: 'bst-delete-two-children', label: '删除情形三：中序前驱顶值' },
      ],
    },
    {
      kind: 'step',
      title: '删除三情形详解',
      body: [
        '```',
        '情形一（叶节点）：父指针置 NULL，free。',
        '情形二（单孩子）：父指针跨过目标指向孙子（孩子顶替）。',
        '情形三（双子）：',
        '  ① 找左子树最大（中序前驱 prev，一路向右到底）',
        '  ② root->data = prev->data（只复制值，节点不动）',
        '  ③ 去左子树删除 prev（它必无右孩子，退化为情形一/二）',
        '```',
        '删除 8（根，双子）：前驱 7 顶上，再去删 7。中序始终有序。',
      ],
    },
    {
      kind: 'time',
      title: '时间复杂度',
      table: {
        headers: ['情形', '查找/插入/删除'],
        rows: [
          ['平衡（接近满树）', 'O(log n)'],
          ['随机插入平均', 'O(log n)'],
          ['退化（按序插入 → 链表）', 'O(n)'],
        ],
      },
      body: ['退化问题由 AVL/红黑树解决（进阶内容，v1.x 方向）。'],
    },
    { kind: 'space', title: '空间复杂度', bullets: ['O(n)；递归操作占 O(h) 栈空间。'] },
    {
      kind: 'pitfalls',
      title: '常见错误（高频！）',
      bullets: [
        '删除双子节点直接用左孩子顶替 → 右子树丢失，BST 性质破坏。',
        '情形三删错方向：值复制后必须去**左子树**删前驱。',
        '插入相等值仍插入 → 破坏性质（需约定策略）。',
        '忘记递归出口 root == NULL。',
      ],
    },
    { kind: 'quiz', title: '小测验', body: ['题库 → 第 9 章。'] },
    { kind: 'exercise', title: '编程练习', body: ['代码练习 → p-bst-search：实现 BST 查找。'] },
  ],
};

const CH10: Chapter = {
  id: 10,
  title: '堆',
  subtitle: '用数组造一棵"永远知道最大值"的完全二叉树',
  keywords: ['堆', 'Heap', '最大堆', '最小堆', '上滤', '下滤', 'heapify', '堆排序', '优先队列'],
  sections: [
    {
      kind: 'what',
      title: '堆是什么',
      body: [
        '堆是**完全二叉树** + 堆性质：最大堆中每个父节点 ≥ 两个孩子（最小堆相反）。',
        '用数组存储：`parent(i) = (i-1)/2`，`left(i) = 2i+1`，`right(i) = 2i+2`，不需要指针。',
      ],
    },
    { kind: 'why', title: '为什么需要', bullets: ['O(1) 取最值、O(log n) 插入/删除：优先队列的标准实现。', '堆排序 O(n log n) 且 O(1) 额外空间。', 'Top-K 问题的高效解法。'] },
    { kind: 'analogy', title: '类比：公司职级', bullets: ['每个上级都比下属"大"（最大堆）。', '新员工入职从最底层干起，能力强就一路晋升（上滤）。', 'CEO 离职，先把最后一个人放到顶，再一路"下沉"到合适位置（下滤）。'] },
    {
      kind: 'diagram',
      title: '树 ↔ 数组 双视图',
      body: [
        '```',
        '        9            数组：[9, 7, 8, 3, 5]',
        '       / \\                 0  1  2  3  4',
        '      7   8           a[1]=7 的父 = a[0]=9',
        '     / \\              a[2]=8 的孩子 = a[5],a[6]（不存在）',
        '    3   5',
        '```',
      ],
      vizOps: [{ op: 'heap-insert', preset: { value: 10 }, label: '插入：上滤动画' }],
    },
    { kind: 'struct', title: '结构定义', codeId: 'heap' },
    { kind: 'operations', title: '核心操作', bullets: ['insert：放末尾，上滤（sift-up）', 'deleteTop：末尾补位，下滤（sift-down）', 'heapify：Floyd 自底向上下滤建堆，O(n)'] },
    { kind: 'code', title: '完整实现', codeId: 'heap' },
    {
      kind: 'animation',
      title: '动画演示',
      vizOps: [
        { op: 'heap-insert', preset: { value: 10 }, label: '插入 10：一路向上交换' },
        { op: 'heap-delete', label: '删除堆顶：补位 + 下滤' },
        { op: 'heap-heapify', label: 'Floyd 建堆：为什么是 O(n)' },
        { op: 'sort-run', preset: { algo: 'heap' }, label: '堆排序全流程' },
      ],
    },
    {
      kind: 'step',
      title: '单步要点',
      bullets: [
        '上滤：新元素只和父比较，最多走树高步 O(log n)。',
        '下滤：和较大的孩子交换（最大堆）。',
        'heapify 从 n/2-1 开始（最后一个非叶节点），倒序执行。',
        '建堆 O(n) 的直觉：大多数节点在底层，下滤距离很短。',
      ],
    },
    { kind: 'time', title: '时间复杂度', table: { headers: ['操作', '复杂度'], rows: [['建堆 heapify', 'O(n)'], ['insert', 'O(log n)'], ['deleteTop', 'O(log n)'], ['取堆顶', 'O(1)'], ['堆排序', 'O(n log n)']] } },
    { kind: 'space', title: '空间复杂度', bullets: ['数组原地 O(1)（不含元素本身）；堆排序无需辅助数组。'] },
    {
      kind: 'pitfalls',
      title: '常见错误',
      bullets: [
        '下滤只和左孩子比较（漏右孩子）。',
        'heapify 从 0 开始正向做（应从 n/2-1 倒序）。',
        '0-based 与 1-based 下标公式混用（本书统一 0-based）。',
        '删除堆顶直接删掉 a[0]（应先交换再缩 size 再下滤）。',
      ],
    },
    { kind: 'quiz', title: '小测验', body: ['题库 → 第 10 章。'] },
    { kind: 'exercise', title: '编程练习', body: ['实现 siftDown，并用它写出堆排序。'] },
  ],
};

const CH11: Chapter = {
  id: 11,
  title: '图',
  subtitle: '最一般的关系结构：顶点 + 边',
  keywords: ['图', 'Graph', '邻接矩阵', '邻接表', 'DFS', 'BFS', '顶点', '边', 'visited'],
  sections: [
    {
      kind: 'what',
      title: '图是什么',
      body: ['图 = 顶点集合 + 边集合。边可以有方向（有向图）或无方向（无向图），可以带权。', '存储：邻接矩阵（二维数组）或邻接表（数组 + 链表）。'],
    },
    { kind: 'why', title: '为什么需要', bullets: ['地图导航、社交网络、依赖关系、状态机都是图。', 'DFS/BFS 是几乎所有图算法的基础。'] },
    { kind: 'analogy', title: '类比：城市与航线', bullets: ['城市 = 顶点，航线 = 边。', '邻接矩阵 = 一张 N×N 的表格（i 行 j 列为 1 表示有航线），查得快但费空间 O(n²)。', '邻接表 = 每个城市挂一张直达城市清单，省空间但查询慢。'] },
    {
      kind: 'diagram',
      title: '两种存储',
      body: [
        '```',
        '   A --- B          邻接矩阵：      邻接表：',
        '   | \\   |            A B C D       A → B,C',
        '   |  \\  |        A [0 1 1 0]      B → A,D',
        '   C --- D          B [1 0 0 1]     C → A,D',
        '                   C [1 0 0 1]     D → B,C',
        '                   D [0 1 1 0]   （无向图对称）',
        '```',
      ],
      vizOps: [{ op: 'graph-bfs', preset: { start: 'A' }, label: 'BFS 动画（队列）' }],
    },
    { kind: 'struct', title: '结构定义', codeId: 'graph' },
    { kind: 'operations', title: '核心操作', bullets: ['添加/删除顶点、边', 'DFS 深度优先（栈/递归）', 'BFS 广度优先（队列）'] },
    { kind: 'code', title: '完整实现', codeId: 'graph' },
    {
      kind: 'animation',
      title: '动画：可以拖动节点、增删点边',
      vizOps: [
        { op: 'graph-edit', label: '打开图编辑器（增删点边/拖动）' },
        { op: 'graph-dfs', preset: { start: 'A' }, label: 'DFS：一条路走到黑（栈）' },
        { op: 'graph-bfs', preset: { start: 'A' }, label: 'BFS：一圈圈扩散（队列）' },
      ],
    },
    {
      kind: 'step',
      title: '单步：visited 为什么必须',
      bullets: [
        '图可能有环：没有 visited 会绕圈死循环。',
        'DFS：访问 u → 对每个未访问邻居递归；栈显示当前路径。',
        'BFS：出队 u → 未访问邻居入队并立刻标记；队列显示待处理层。',
        'BFS 标记时机 = 入队时（不是出队时），否则重复入队。',
      ],
    },
    {
      kind: 'time',
      title: '时间复杂度',
      table: {
        headers: ['', '邻接矩阵', '邻接表'],
        rows: [
          ['DFS / BFS', 'O(n²)', 'O(n + e)'],
          ['查两点是否相邻', 'O(1)', 'O(度)'],
          ['空间', 'O(n²)', 'O(n + e)'],
        ],
      },
    },
    { kind: 'space', title: '空间复杂度', bullets: ['矩阵 O(n²) 适合稠密图；邻接表 O(n+e) 适合稀疏图。'] },
    {
      kind: 'pitfalls',
      title: '常见错误',
      bullets: [
        '忘记 visited → 死循环。',
        'BFS 出队才标记 → 同一顶点重复入队。',
        '无向图只存单向边。',
        '删顶点忘记级联删边。',
        'DFS 递归深度太大 → 栈溢出（大图改用显式栈）。',
      ],
    },
    { kind: 'quiz', title: '小测验', body: ['题库 → 第 11 章。'] },
    { kind: 'exercise', title: '编程练习', body: ['用邻接矩阵实现 BFS，输出访问顺序。'] },
  ],
};

const CH12: Chapter = {
  id: 12,
  title: '查找算法',
  subtitle: '顺序查找与二分查找',
  keywords: ['查找', '搜索', '顺序查找', '二分查找', '有序', '折半'],
  sections: [
    { kind: 'what', title: '查找是什么', body: ['在数据集合中定位目标值：返回下标/指针，找不到返回 -1/NULL。本章讲两种经典方法。'] },
    { kind: 'why', title: '为什么重要', bullets: ['查找是使用频率最高的操作之一（数据库、缓存、编译器符号表）。', '二分查找是"利用有序性"思想的起点。'] },
    { kind: 'analogy', title: '类比', bullets: ['顺序查找 = 从头翻到尾；二分查找 = 翻字典，每次从中间劈开。'] },
    {
      kind: 'diagram',
      title: '二分的区间收缩',
      body: [
        '```',
        '[1] 3 [5] 7 9 11 13 15   找 7：',
        ' lo=0 hi=7 mid=3 → a[3]=7 命中！',
        '',
        '找 8：',
        ' lo=0 hi=7 mid=3 → 7<8 → lo=4',
        ' lo=4 hi=7 mid=5 → 11>8 → hi=4',
        ' lo=4 hi=4 mid=4 → 9>8 → hi=3',
        ' lo>hi → 不存在，返回 -1',
        '```',
      ],
      vizOps: [{ op: 'search-binary', preset: { target: 7 }, label: '二分查找动画' }],
    },
    { kind: 'struct', title: '无新结构', body: ['查找作用于已有结构（本章以有序数组为例）。'] },
    { kind: 'operations', title: '两种查找', bullets: ['顺序查找：O(n)，不要求数据有序', '二分查找：O(log n)，**必须有序**'] },
    { kind: 'code', title: '实现', codeId: 'search' },
    {
      kind: 'animation',
      title: '动画演示',
      vizOps: [
        { op: 'search-linear', preset: { target: 9 }, label: '顺序查找' },
        { op: 'search-binary', preset: { target: 7 }, label: '二分查找：区间逐步减半' },
        { op: 'search-binary-unsorted', label: '错误示范：无序数组用二分' },
      ],
    },
    {
      kind: 'step',
      title: '单步要点',
      bullets: [
        'mid 用 low + (high-low)/2 而不是 (low+high)/2（防溢出）。',
        '每一步排除一半：low=mid+1 或 high=mid-1（+1/-1 防死循环）。',
        '结束条件 low > high。',
        '无序数组上二分可能"路过目标却返回 -1"。',
      ],
    },
    { kind: 'time', title: '时间复杂度', table: { headers: ['算法', '复杂度', '前提'], rows: [['顺序查找', 'O(n)', '无'], ['二分查找', 'O(log n)', '数组有序 + 支持随机访问']] } },
    { kind: 'space', title: '空间复杂度', bullets: ['两者 O(1)（迭代版）。链表不能高效二分：不支持随机访问。'] },
    {
      kind: 'pitfalls',
      title: '常见错误（高频！）',
      bullets: [
        '对无序数组用二分。',
        'low = mid（而不是 mid+1）→ 死循环。',
        '循环条件写成 low < high（漏掉 low==high 的最后候选）。',
        'mid 溢出写法 (low+high)/2。',
      ],
    },
    { kind: 'quiz', title: '小测验', body: ['题库 → 第 12 章。'] },
    { kind: 'exercise', title: '编程练习', body: ['代码练习 → p-binary-search：实现二分查找。'] },
  ],
};

const CH13: Chapter = {
  id: 13,
  title: '排序算法',
  subtitle: '七种经典排序：从 O(n²) 到 O(n log n)',
  keywords: ['排序', '冒泡', '选择', '插入', '希尔', '归并', '快速', '堆排序', '稳定性', '比较', '交换'],
  sections: [
    { kind: 'what', title: '排序是什么', body: ['把无序数据按关键字排成有序序列。本章七种算法按由浅入深排列。'] },
    { kind: 'why', title: '为什么重要', bullets: ['有序是二分查找等一大类算法的前提。', '排序是练习复杂度分析、边界处理的最佳素材。', '面试必考。'] },
    { kind: 'analogy', title: '类比', bullets: ['冒泡 = 相邻两人比身高，高的往后站。', '选择 = 每轮挑最矮的排到队首。', '插入 = 起扑克牌，抽一张插进手里已排好的牌。', '归并 = 两摞已排好的牌合成一摞。', '快排 = 挑一个人当基准，比他矮的站左边高的站右边，两边再重复。'] },
    {
      kind: 'diagram',
      title: '总览对比',
      body: [
        '```',
        '算法     平均        最坏        空间     稳定',
        '冒泡     O(n²)       O(n²)       O(1)     ✓',
        '选择     O(n²)       O(n²)       O(1)     ✗',
        '插入     O(n²)       O(n²)       O(1)     ✓',
        '希尔     ~O(n^1.3)   O(n²)       O(1)     ✗',
        '归并     O(n log n)  O(n log n)  O(n)     ✓',
        '快速     O(n log n)  O(n²)       O(log n) ✗',
        '堆       O(n log n)  O(n log n)  O(1)     ✗',
        '```',
      ],
      vizOps: [{ op: 'sort-run', preset: { algo: 'bubble' }, label: '打开排序实验室' }],
    },
    { kind: 'struct', title: '无新结构', body: ['排序作用于数组；堆排序用到第 10 章的堆。'] },
    { kind: 'operations', title: '七种算法一句话', bullets: ['冒泡：相邻比较交换，每趟定一个最大值到末尾', '选择：每轮选最小放前面，交换次数最少', '插入：抽牌左插，基本有序时极快', '希尔：按间隔分组插入，间隔逐趟减半', '归并：分治 + 线性合并，稳定且最坏也是 O(n log n)', '快速：基准分区，平均最快，最坏 O(n²)', '堆：建堆 + 逐个取顶，O(1) 空间'] },
    { kind: 'code', title: '七段实现（代码面板可切换算法）', codeId: 'sort-quick' },
    {
      kind: 'animation',
      title: '动画 + Compare Mode',
      vizOps: [
        { op: 'sort-run', preset: { algo: 'bubble' }, label: '冒泡' },
        { op: 'sort-run', preset: { algo: 'quick' }, label: '快速（看 pivot 分区）' },
        { op: 'sort-run', preset: { algo: 'merge' }, label: '归并（看区间合并）' },
        { op: 'sort-compare', label: 'Compare Mode：3 个算法并排比' },
      ],
    },
    {
      kind: 'step',
      title: '单步观察要点',
      bullets: [
        '冒泡：已排序区如何从尾部生长。',
        '选择：min 下标的更新轨迹。',
        '插入：key 的"空位"如何腾出。',
        '快排：i 边界（小于区）如何扩张、pivot 归位。',
        '归并：merge range 的收缩与写回。',
        '计数器：比较/交换次数与理论值的对应。',
      ],
    },
    { kind: 'time', title: '复杂度与稳定性', body: ['详见上方总览表。要点：稳定 = 相等元素相对顺序不变（冒泡/插入/归并稳定）。', '快排最坏发生在已有序输入 + 固定取尾为 pivot（可随机化规避）。'] },
    { kind: 'space', title: '空间复杂度', bullets: ['归并需要 O(n) 辅助数组；快排 O(log n) 递归栈；其余原地 O(1)。'] },
    {
      kind: 'pitfalls',
      title: '常见错误',
      bullets: [
        '冒泡内层边界 j < n-1-i（不减 i 会重比已排序区）。',
        '插入从前往后挪（会覆盖未挪数据，必须从后往前）。',
        '归并忘记写回 / 临时数组越界。',
        '快排 pivot 归位后把它包含进子区间 → 死循环。',
        '希尔最后一趟 gap 必须 = 1。',
      ],
    },
    { kind: 'quiz', title: '小测验', body: ['题库 → 第 13 章：排序是一题多考点重灾区。'] },
    { kind: 'exercise', title: '编程练习', body: ['代码练习 → p-bubble-sort / p-quick-sort：亲手实现两种排序。'] },
  ],
};

export { CH08, CH09, CH10, CH11, CH12, CH13 };
