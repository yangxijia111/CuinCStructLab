/**
 * Chapter 2~7：线性结构章节（顺序表/单链表/双向链表/栈/队列/字符串与数组）。
 * C 代码直接引用 core/data-structures 模块导出的教学代码（保证与动画 codeLine 一致）。
 */
import type { Chapter, CProgramRef, Section } from '../types';
import { SEQ_LIST_C_CODE } from '../../core/data-structures/seqlist';
import { LINKED_LIST_C_CODE } from '../../core/data-structures/linked-list';
import { DOUBLY_LIST_C_CODE } from '../../core/data-structures/doubly-list';
import { STACK_C_CODE } from '../../core/data-structures/stack';
import { QUEUE_C_CODE } from '../../core/data-structures/queue';

export const CH02_C_PROGRAMS: CProgramRef[] = [
  { id: 'seqlist', title: '顺序表完整实现（SeqList）', lines: SEQ_LIST_C_CODE },
];

export const CH03_C_PROGRAMS: CProgramRef[] = [
  { id: 'linked-list', title: '单链表完整实现（带头节点）', lines: LINKED_LIST_C_CODE },
];

export const CH04_C_PROGRAMS: CProgramRef[] = [
  { id: 'doubly-list', title: '双向链表完整实现', lines: DOUBLY_LIST_C_CODE },
];

export const CH05_C_PROGRAMS: CProgramRef[] = [
  { id: 'stack', title: '栈：顺序栈 + 链栈 + 括号匹配', lines: STACK_C_CODE },
];

export const CH06_C_PROGRAMS: CProgramRef[] = [
  { id: 'queue', title: '队列：循环队列 + 链队列 + 假溢出', lines: QUEUE_C_CODE },
];

export const CH07_C_PROGRAMS: CProgramRef[] = [
  {
    id: 'ch07-array2d',
    title: '二维数组与字符串',
    lines: [
      '/* 数组、二维数组与字符串 */',
      '#include <stdio.h>',
      '#include <string.h>',
      '',
      'int main(void) {',
      '    int a[5] = {1, 2, 3, 4, 5};       /* 一维：连续 5 个 int */',
      '    printf("%d\\n", a[2]);            /* a[i] = *(a+i) */',
      '',
      '    int m[2][3] = {{1,2,3},{4,5,6}};  /* 二维：3 行按行优先连续存放 */',
      '    printf("%d\\n", m[1][2]);         /* 6：m[i][j] = *(&m[0][0] + i*3 + j) */',
      '',
      '    char s[] = "hello";               /* 字符数组：6 字节，含结尾 \'\\0\' */',
      '    printf("%zu\\n", sizeof(s));       /* 6，不是 5！ */',
      '    printf("%zu\\n", strlen(s));      /* 5：不算 \'\\0\' */',
      '',
      '    char t[10];',
      '    strcpy(t, s);                     /* 复制到 t，含 \'\\0\' */',
      '    strcat(t, " world");              /* 拼接，注意 t 要足够大 */',
      '    printf("%s\\n", t);               /* hello world */',
      '    return 0;',
      '}',
    ],
    notes: {
      6: '一维数组在内存里是连续的格子：这是顺序表、堆、邻接矩阵的物理基础。',
      9: '二维数组按"行优先"拉平存储：m[i][j] 的地址 = 起点 + (i*列数 + j)*sizeof(int)。',
      12: 'C 字符串 = 字符数组 + 结尾 \'\\0\'。sizeof 算内存（含 \\0），strlen 数字符（不含）。',
      17: 'strcpy/strcat 的目标必须足够大，否则缓冲区溢出——C 最著名的安全问题之一。',
    },
  },
  {
    id: 'ch07-mystrlen',
    title: '手写 strlen / strcpy',
    lines: [
      '/* 理解字符串操作的本质：走到 \'\\0\' 为止 */',
      'size_t myStrlen(const char *s) {',
      '    size_t len = 0;',
      '    while (s[len] != \'\\0\') {   /* 没到结尾就数下去 */',
      '        len++;',
      '    }',
      '    return len;',
      '}',
      '',
      'void myStrcpy(char *dst, const char *src) {',
      '    int i = 0;',
      '    while (src[i] != \'\\0\') {',
      '        dst[i] = src[i];       /* 逐字符复制 */',
      '        i++;',
      '    }',
      '    dst[i] = \'\\0\';           /* 别忘了复制结束符！ */',
      '}',
    ],
    notes: {
      4: 'strlen 是 O(n) 的——每次调用都要走一遍。循环条件里写 strlen 是常见性能错误。',
      15: '漏复制 \\0 会让后续 printf 一直读到内存外面（未定义行为）。',
    },
  },
];

const CH02: Chapter = {
  id: 2,
  title: '顺序表',
  subtitle: '动态数组：连续内存 + size + capacity',
  keywords: ['顺序表', '数组', 'SeqList', '扩容', '插入', '删除', '线性表'],
  sections: [
    {
      kind: 'what',
      title: '顺序表是什么',
      body: [
        '顺序表（Sequential List）是用**一块连续内存**存放元素的线性表，额外用 size 记录当前元素个数、capacity 记录容量。',
        '```c',
        'typedef struct {',
        '    int *data;      /* 指向堆上数组 */',
        '    int size;       /* 元素个数 */',
        '    int capacity;   /* 容量 */',
        '} SeqList;',
        '```',
      ],
    },
    {
      kind: 'why',
      title: '为什么需要',
      bullets: [
        'C 数组长度编译期定死；顺序表用 malloc + 扩容实现"能长大的数组"。',
        '随机访问 O(1)：a[i] 一步直达。',
        '它是 C++ vector、Python list 的底层形态。',
      ],
    },
    {
      kind: 'analogy',
      title: '类比：电影院一排座位',
      bullets: [
        '容量 capacity = 这一排的座位总数；size = 已坐的人数。',
        '插入中间 = 让后面的人集体往后挪一格。',
        '删除中间 = 前面的人集体往前挪。',
        '坐满了想再加人 = 换一排两倍长的座位，全体搬家（扩容）。',
      ],
    },
    {
      kind: 'diagram',
      title: '内存布局',
      body: [
        '```',
        'data ──→ [10][20][30][  ][  ]',
        '          0   1   2   3   4',
        '         └── size=3 ──┘└capacity=5┘',
        '```',
        '格子连续排列，下标即偏移量。size 之外的格子是"已租未用"的空间。',
      ],
      vizOps: [{ op: 'seqlist-insert', label: '看插入时数据如何搬移' }],
    },
    { kind: 'struct', title: '结构定义', codeId: 'seqlist' },
    {
      kind: 'operations',
      title: '七个核心操作',
      bullets: [
        '初始化 init：malloc 初始容量，size=0',
        '插入 insert(pos, v)：合法范围 0 ≤ pos ≤ size；先挪后插',
        '删除 delete(pos)：前挪覆盖，size-1',
        '查找 find(v)：从头扫描，返回首个下标或 -1',
        '修改 set(pos, v)：下标直达',
        '遍历 traverse：依次访问',
        '扩容 grow：容量 ×2，搬移后释放旧数组',
      ],
    },
    { kind: 'code', title: '完整实现（右侧逐行解释）', codeId: 'seqlist' },
    {
      kind: 'animation',
      title: '动画演示',
      vizOps: [
        { op: 'seqlist-init', label: '初始化：malloc 与成员赋值' },
        { op: 'seqlist-insert', preset: { pos: 1, value: 15 }, label: '中间插入（观察搬移方向）' },
        { op: 'seqlist-delete', label: '删除中间元素' },
        { op: 'seqlist-grow', label: '扩容：搬家三部曲' },
      ],
    },
    {
      kind: 'step',
      title: '单步要点',
      bullets: [
        '插入为什么"从后往前"挪？（从前往后会覆盖未搬数据）',
        '扩容为什么必须 free 旧数组？（泄漏）',
        'size 与 capacity 的区别在哪一步体现？',
      ],
    },
    {
      kind: 'time',
      title: '时间复杂度',
      table: {
        headers: ['操作', '复杂度', '原因'],
        rows: [
          ['下标访问/修改', 'O(1)', '地址 = 起点 + i×sizeof(int)'],
          ['头插/头删', 'O(n)', '挪动全部元素'],
          ['尾插（不扩容）', 'O(1)', '直接放 size 位置'],
          ['尾插（扩容时）', 'O(n)', '搬家；摊还后 O(1)'],
          ['查找', 'O(n)', '逐个比较'],
        ],
      },
    },
    {
      kind: 'space',
      title: '空间复杂度',
      bullets: ['存储 O(n)；扩容策略为 ×2 时，浪费的空间平均不超过一倍（摊还分析）。'],
    },
    {
      kind: 'pitfalls',
      title: '常见错误',
      bullets: [
        '插入范围写成 0 ≤ pos < size（漏掉 pos == size 的尾插）。',
        '搬移方向反了：从前往后挪会覆盖数据。',
        '扩容后忘记 free 旧数组（泄漏）或先 free 再读 old 数据（use-after-free）。',
        '删除后忘记 size-1。',
        'malloc 返回值不判空。',
      ],
    },
    { kind: 'quiz', title: '小测验', body: ['题库 → 第 2 章：覆盖搬移方向、扩容、边界。'] },
    { kind: 'exercise', title: '编程练习', body: ['代码练习 → p-seqlist-insert：亲手实现顺序表插入。'] },
  ],
};

const CH03: Chapter = {
  id: 3,
  title: '单链表',
  subtitle: '指针串起的节点：接线 O(1)，但定位要 O(n)——失去随机访问的代价',
  keywords: ['单链表', '链表', 'Node', '指针', '头插', '尾插', '插入', '删除', '遍历', 'free'],
  sections: [
    {
      kind: 'what',
      title: '单链表是什么',
      body: [
        '单链表的每个元素是一个独立节点（Node），节点里除了数据还有一个 **next 指针**指向下一个节点，末节点的 next 为 NULL。',
        '```c',
        'typedef struct Node {',
        '    int data;',
        '    struct Node *next;',
        '} Node;',
        '```',
        '采用**带头节点（哨兵）**写法：head 指向一个不存数据的头节点，第一个数据节点是 head->next。',
      ],
    },
    {
      kind: 'why',
      title: '为什么需要',
      bullets: [
        '顺序表插删要挪一串数据；链表只改两个指针。',
        '大小动态生长，无需预估容量。',
        '是栈、队列、树、图邻接表的基础组件。',
      ],
    },
    {
      kind: 'analogy',
      title: '类比：寻宝游戏',
      bullets: [
        '每个线索（节点）写着奖品（data）和下一条线索的位置（next）。',
        '最后一条线索写"宝箱在此，游戏结束"（NULL）。',
        '你只能按顺序走，不能直接跳到第 5 条（没有随机访问）。',
        '插入线索 = 新线索先抄下一条的位置，再让上一条指向自己。顺序反了，后面的线索就再也找不到了（断链）。',
      ],
    },
    {
      kind: 'diagram',
      title: '节点与链',
      body: [
        '```',
        'HEAD',
        ' ↓',
        '[头 |-]→ [10 |•]→ [20 |•]→ [30 | ∅]',
        '```',
        '每个节点两格：数据域 | 指针域。最后一个指针域是 NULL（∅）。',
      ],
      vizOps: [{ op: 'list-insert', preset: { pos: 1, value: 15 }, label: '插入动画：看指针怎么变' }],
    },
    { kind: 'struct', title: '结构定义', codeId: 'linked-list' },
    {
      kind: 'operations',
      title: '核心操作',
      bullets: [
        '初始化：创建头节点，next=NULL',
        '头插 pushFront：新节点接在 head 之后',
        '尾插 pushBack：走到尾部接上',
        '指定位置插入 insertAt(pos, v)',
        '删除 delete：prev 绕过 target',
        '查找 find / 修改 set',
        '遍历 traverse',
        '销毁 destroy：先存 next 再 free',
      ],
    },
    { kind: 'code', title: '完整实现（右侧逐行解释）', codeId: 'linked-list' },
    {
      kind: 'animation',
      title: '动画：重点看指针',
      vizOps: [
        { op: 'list-insert', preset: { pos: 1, value: 15 }, label: '插入：两步接线' },
        { op: 'list-delete', preset: { value: 20 }, label: '删除：绕过 + free' },
        { op: 'list-traverse', label: '遍历：current 一步步走' },
        { op: 'list-destroy', label: '销毁：为什么先存 next' },
      ],
    },
    {
      kind: 'step',
      title: '单步执行（新手必看）',
      body: [
        '插入 15 到位置 1（链表 10→20→30）：',
        '```',
        '第①步  newNode->next = prev->next;   新节点先抓住 20',
        '第②步  prev->next = newNode;         10 改指 15',
        '结果   10 → 15 → 20 → 30',
        '```',
        '两步顺序**绝不能反**：先做第②步，20 和 30 就永远丢失了。',
      ],
    },
    {
      kind: 'time',
      title: '时间复杂度',
      table: {
        headers: ['操作', '复杂度', '说明'],
        rows: [
          ['头插', 'O(1)', '只改两个指针'],
          ['尾插', 'O(n)', '要先走到尾（无尾指针时）'],
          ['任意位置插/删', 'O(n) 定位 + O(1) 接线', '定位是瓶颈'],
          ['查找', 'O(n)', '只能顺藤摸瓜'],
          ['下标访问', 'O(n)', '没有随机访问！'],
        ],
      },
    },
    {
      kind: 'space',
      title: '空间复杂度',
      bullets: ['O(n)，且每个节点多一个指针的开销（8 字节/节点）。', '空间不连续：对缓存不友好（对比顺序表）。'],
    },
    {
      kind: 'pitfalls',
      title: '常见错误（高频！）',
      bullets: [
        '插入两步接线顺序颠倒 → 断链，后半条链丢失。',
        '删除时不找 prev，直接 free 当前节点 → 后面的节点再也找不到。',
        'free 之后再读 current->next → use-after-free。',
        '遍历条件写成 current->next != NULL → 漏掉最后一个节点。',
        '空链表直接 head->next 解引用 → 崩溃。',
        '忘记 destroy → 整条链泄漏。',
      ],
    },
    { kind: 'quiz', title: '小测验', body: ['题库 → 第 3 章：指针变化、断链判断、执行结果。'] },
    { kind: 'exercise', title: '编程练习', body: ['代码练习 → p-list-pushback / p-list-delete：实现尾插与删除。'] },
  ],
};

const CH04: Chapter = {
  id: 4,
  title: '双向链表',
  subtitle: 'prev + next：用空间换"回头路"',
  keywords: ['双向链表', 'DNode', 'prev', 'next', '插入', '删除', '双向遍历'],
  sections: [
    {
      kind: 'what',
      title: '双向链表是什么',
      body: [
        '每个节点有两个指针：prev 指向前驱、next 指向后继。',
        '```c',
        'typedef struct DNode {',
        '    int data;',
        '    struct DNode *prev;',
        '    struct DNode *next;',
        '} DNode;',
        '```',
      ],
    },
    {
      kind: 'why',
      title: '为什么需要',
      bullets: [
        '单链表找前驱要 O(n)；双向链表 O(1)。',
        '删除已知节点时不需要先定位前驱。',
        '浏览器"前进/后退"、LRU 缓存都靠它。',
      ],
    },
    {
      kind: 'analogy',
      title: '类比：火车车厢',
      bullets: ['每节车厢两端都有挂钩（prev/next），既能往前走也能往后走。', '摘掉一节车厢，要把前后两节直接挂起来（两步绕过）。'],
    },
    {
      kind: 'diagram',
      title: '结构图示',
      body: [
        '```',
        'NULL ← [头 |-] ⇄ [10 |-] ⇄ [20 |-] ⇄ NULL',
        '```',
        '相邻节点互相指向。空位方向：头节点 prev 为 NULL，尾节点 next 为 NULL。',
      ],
      vizOps: [{ op: 'doubly-insert', label: '四步插入动画' }],
    },
    { kind: 'struct', title: '结构定义', codeId: 'doubly-list' },
    {
      kind: 'operations',
      title: '核心操作',
      bullets: [
        '头插/尾插',
        '插入 insertAfter：四步接线（①② 接新节点，③ 改原首节点，④ 改前驱）',
        '删除 delete：前驱、后继互相绕过',
        '正向遍历 / 反向遍历',
      ],
    },
    { kind: 'code', title: '完整实现', codeId: 'doubly-list' },
    {
      kind: 'animation',
      title: '动画演示',
      vizOps: [
        { op: 'doubly-insert', label: '插入：四步接线逐一展示' },
        { op: 'doubly-delete', label: '删除：两步绕过' },
        { op: 'doubly-traverse', label: '正向 + 反向遍历' },
      ],
    },
    {
      kind: 'step',
      title: '单步要点',
      body: [
        '插入（在 p 之后）四步：',
        '```',
        '① newNode->prev = p;',
        '② newNode->next = p->next;',
        '③ p->next->prev = newNode;   ← 单链表没有这步！',
        '④ p->next = newNode;',
        '```',
        '删除两步：target->prev->next = target->next; target->next->prev = target->prev;',
      ],
    },
    {
      kind: 'time',
      title: '时间复杂度',
      table: {
        headers: ['操作', '单链表', '双向链表'],
        rows: [
          ['找前驱', 'O(n)', 'O(1)'],
          ['删除已知节点', 'O(n)（先找前驱）', 'O(1)'],
          ['头插', 'O(1)', 'O(1)'],
          ['任意位置插入', 'O(n)', 'O(n)（定位仍要走路）'],
        ],
      },
    },
    { kind: 'space', title: '空间复杂度', bullets: ['O(n)，每节点两个指针，比单链表多 8 字节。'] },
    {
      kind: 'pitfalls',
      title: '常见错误',
      bullets: [
        '插入漏掉第③步（原首节点的 prev 没改）→ 反向遍历走错。',
        '删除只绕过一边 → prev/next 不一致。',
        '边界：空链表插入时 head->next 是 NULL，第③步要判空。',
        '尾节点 next、头节点 prev 忘判空就解引用。',
      ],
    },
    { kind: 'quiz', title: '小测验', body: ['题库 → 第 4 章。'] },
    { kind: 'exercise', title: '编程练习', body: ['把第 3 章的链表题改成双向版本再写一遍。'] },
  ],
};

const CH05: Chapter = {
  id: 5,
  title: '栈',
  subtitle: '后进先出 LIFO：-push/pop 都在栈顶',
  keywords: ['栈', 'Stack', 'push', 'pop', 'top', '顺序栈', '链栈', '括号匹配', '表达式求值', '递归栈'],
  sections: [
    {
      kind: 'what',
      title: '栈是什么',
      body: ['栈是只允许在**一端（栈顶）**插入和删除的线性表。后进先出（LIFO）。', '实现方式：顺序栈（数组 + top 下标）或链栈（头插头删）。'],
    },
    {
      kind: 'why',
      title: '为什么需要',
      bullets: [
        '很多问题天然 LIFO：函数调用、括号嵌套、撤销操作、DFS。',
        '限制操作 = 暴露最少的接口，逻辑更简单、错误更少。',
      ],
    },
    {
      kind: 'analogy',
      title: '类比：摞盘子',
      bullets: ['只能放在最上面（push），也只能从最上面拿（pop）。', '想拿最底下的盘子，必须先把上面的全拿走。'],
    },
    {
      kind: 'diagram',
      title: '栈的图示',
      body: [
        '```',
        'push(30) 后：      pop() 后：',
        '   ┌────┐ 栈顶        ┌────┐ 栈顶',
        '   │ 30 │ ←top        │ 20 │ ←top',
        '   ├────┤              ├────┤',
        '   │ 20 │              │ 10 │',
        '   ├────┤              └────┘',
        '   │ 10 │',
        '   └────┘',
        '```',
      ],
      vizOps: [{ op: 'stack-push', label: 'push 动画' }, { op: 'stack-pop', label: 'pop 动画' }],
    },
    { kind: 'struct', title: '顺序栈定义', codeId: 'stack' },
    {
      kind: 'operations',
      title: '核心操作与应用',
      bullets: [
        'push：栈满则失败（overflow）',
        'pop：栈空则失败（underflow）',
        'top/peek：看栈顶不弹出',
        'isEmpty / isFull',
        '应用：括号匹配、表达式求值（中缀→后缀）、递归调用栈、DFS',
      ],
    },
    { kind: 'code', title: '完整实现（含括号匹配）', codeId: 'stack' },
    {
      kind: 'animation',
      title: '动画演示',
      vizOps: [
        { op: 'stack-push', label: 'push：先放元素再移 top' },
        { op: 'stack-pop', label: 'pop：先移 top 再取元素' },
        { op: 'bracket-match', preset: { input: '{[()]}' }, label: '括号匹配：栈的消长' },
        { op: 'stack-linked', label: '链栈：头插头删' },
      ],
    },
    {
      kind: 'step',
      title: '括号匹配单步逻辑',
      bullets: [
        '遇到左括号 → 入栈等待',
        '遇到右括号 → 弹栈顶配对：类型不一致 = 失败；栈已空 = 右括号多了',
        '扫完字符串 → 栈非空 = 左括号多了；栈空 = 匹配成功',
      ],
    },
    {
      kind: 'time',
      title: '时间复杂度',
      bullets: ['push / pop / top / isEmpty 全部 O(1)——这正是限制操作换来的。', '括号匹配 O(n)：每个字符处理一次。'],
    },
    { kind: 'space', title: '空间复杂度', bullets: ['顺序栈 O(capacity) 固定；链栈 O(n) 按需。'] },
    {
      kind: 'pitfalls',
      title: '常见错误',
      bullets: [
        'pop 前不判空 → 下溢（读垃圾数据或崩溃）。',
        'push 前不判满（顺序栈）→ 越界写。',
        'top 约定混乱：本书 top 指向"下一个空位"，空栈 top=0；有的书 top=-1。混用必错。',
        '括号匹配只数数量不看类型：([)] 数量对但类型错。',
      ],
    },
    { kind: 'quiz', title: '小测验', body: ['题库 → 第 5 章：出栈序列合法性是经典考点。'] },
    { kind: 'exercise', title: '编程练习', body: ['代码练习 → p-stack-push：实现顺序栈。'] },
  ],
};

const CH06: Chapter = {
  id: 6,
  title: '队列',
  subtitle: '先进先出 FIFO：从队尾进、队头出',
  keywords: ['队列', 'Queue', 'enqueue', 'dequeue', 'front', 'rear', '循环队列', '链队列', '假溢出', '取模'],
  sections: [
    {
      kind: 'what',
      title: '队列是什么',
      body: ['队列只允许**队尾进（enqueue）、队头出（dequeue）**，先进先出（FIFO）。', '实现：朴素顺序队列（有假溢出缺陷）→ 循环队列 → 链队列。'],
    },
    {
      kind: 'why',
      title: '为什么需要',
      bullets: ['排队问题天然 FIFO：任务调度、BFS、消息缓冲。', 'BFS 的"一层层扩展"正是靠队列维持顺序。'],
    },
    { kind: 'analogy', title: '类比：排队买奶茶', bullets: ['新来的排队尾（rear 进），出餐从队头开始（front 出）。', '循环队列 = 排成一个圈，走到底自动回到开头。'] },
    {
      kind: 'diagram',
      title: '循环队列图示',
      body: [
        '```',
        '容量 6 的环（最多装 5 个，留一个空位区分空/满）：',
        '        [0]',
        '     [5]    [1] ← rear（下一个入队位）',
        '       ↑     ↑',
        '    front   当前队尾',
        '     [4]    [2]',
        '        [3]',
        '',
        '判空：front == rear',
        '判满：(rear + 1) % capacity == front',
        '移动：front = (front + 1) % capacity',
        '```',
      ],
      vizOps: [{ op: 'queue-circular', label: '循环队列 wrap-around 动画' }],
    },
    { kind: 'struct', title: '循环队列定义', codeId: 'queue' },
    {
      kind: 'operations',
      title: '核心操作',
      bullets: [
        'enqueue：队满失败；放 rear 位置，rear 取模后移',
        'dequeue：队空失败；取 front 位置，front 取模后移',
        'getFront / getRear',
        'isEmpty（front==rear）/ isFull（留一空位法）',
      ],
    },
    { kind: 'code', title: '完整实现（三种队列）', codeId: 'queue' },
    {
      kind: 'animation',
      title: '动画演示',
      vizOps: [
        { op: 'queue-naive', label: '反面教材：假溢出是怎么发生的' },
        { op: 'queue-circular', label: '循环队列：rear 回绕' },
        { op: 'queue-linked', label: '链队列：空队的两次特判' },
      ],
    },
    {
      kind: 'step',
      title: '单步要点：为什么 (rear+1) % capacity',
      bullets: [
        'rear 走到 capacity-1 后，+1 = capacity 越界；对 capacity 取模回到 0。',
        '例：capacity=6，rear=5 → (5+1)%6 = 0。',
        '留一个空位：否则 front==rear 无法区分"空"和"满"。',
        '代价：容量 n 的循环队列最多存 n-1 个元素。',
      ],
    },
    {
      kind: 'time',
      title: '时间复杂度',
      bullets: ['enqueue / dequeue / 判空判满都是 O(1)。'],
    },
    { kind: 'space', title: '空间复杂度', bullets: ['循环队列固定 O(capacity)，浪费 1 格；链队列 O(n) 按需。'] },
    {
      kind: 'pitfalls',
      title: '常见错误（高频！）',
      bullets: [
        '判满写成 rear == capacity-1（那是朴素队列的"假满"）。',
        'front/rear 移动忘记取模 → 越界。',
        '把"留一空位"和"计数 count"两种方案混用。',
        '链队列出队到空时忘记把 rear 也置 NULL → 下次 enqueue 解引用悬垂 rear。',
        '空队列入队忘记同时更新 front。',
      ],
    },
    { kind: 'quiz', title: '小测验', body: ['题库 → 第 6 章：循环队列下标计算是必考点。'] },
    { kind: 'exercise', title: '编程练习', body: ['代码练习 → p-circular-enqueue：实现循环队列入队。'] },
  ],
};

const CH07: Chapter = {
  id: 7,
  title: '字符串与数组基础',
  subtitle: '连续内存的两种经典用法',
  keywords: ['数组', '二维数组', '字符串', '字符串结尾', '内存布局', '行优先', 'strlen', 'strcpy'],
  sections: [
    {
      kind: 'what',
      title: '这一章讲什么',
      body: ['数组：同类型元素的连续内存。字符串：以 \\0 结尾的字符数组。二维数组：按行优先拉平的一维内存。'],
    },
    {
      kind: 'why',
      title: '为什么重要',
      bullets: [
        '顺序表/堆/邻接矩阵的物理基础都是数组。',
        '字符串处理是 C 面试的高频考点，也是缓冲区溢出的重灾区。',
        '理解"二维数组其实是连续内存"才能看懂图和 DP 的代码。',
      ],
    },
    { kind: 'analogy', title: '类比', bullets: ['一维数组 = 一排储物柜；二维数组 = 把柜子编号成"第几排第几个"，物理上仍是一排。', '字符串 = 柜子里的字符 + 最后一个"结束牌"（\\0）。'] },
    {
      kind: 'diagram',
      title: '内存布局',
      body: [
        '```',
        'char s[] = "hi";       int m[2][3] = {{1,2,3},{4,5,6}};',
        '',
        ' s: [h][i][\\0]         m: [1][2][3][4][5][6]   ← 行优先连续！',
        '     0  1  2               0  1  2  3  4  5',
        '                            └ 第0行 ┘└ 第1行 ┘',
        'm[1][2] 的地址 = m + (1*3 + 2)*sizeof(int)',
        '```',
      ],
      vizOps: [{ op: 'array-write', label: 'a[2] = 10：下标直达动画' }],
    },
    { kind: 'struct', title: '定义方式', codeId: 'ch07-array2d' },
    {
      kind: 'operations',
      title: '常用操作',
      bullets: ['下标读写 a[i]（O(1)）', 'strlen（O(n)，数到 \\0）', 'strcpy / strcat / strcmp', '手写版本见代码面板'],
    },
    { kind: 'code', title: '数组与字符串代码', codeId: 'ch07-array2d' },
    {
      kind: 'animation',
      title: '动画演示',
      vizOps: [
        { op: 'array-write', label: 'a[2]=10：index=2 突出 3→10' },
        { op: 'array-traverse', label: '遍历数组' },
      ],
    },
    { kind: 'step', title: '单步建议', bullets: ['手写 myStrlen 逐步走，体会"到 \\0 停"。'] },
    {
      kind: 'time',
      title: '时间复杂度',
      bullets: ['下标访问 O(1)；strlen/遍历 O(n)；strcpy O(n)。'],
    },
    { kind: 'space', title: '空间复杂度', bullets: ['sizeof(s) 包含 \\0；strlen 不包含——两者的差是经典考题。'] },
    {
      kind: 'pitfalls',
      title: '常见错误',
      bullets: [
        'strcpy 目标空间不够 → 缓冲区溢出。',
        '自己写字符串复制忘记拷 \\0。',
        '越界访问 a[n]（下标从 0 开始，最大 n-1）。',
        '循环条件里反复调用 strlen（每次都 O(n)）。',
        '把 sizeof(指针) 当数组长度。',
      ],
    },
    { kind: 'quiz', title: '小测验', body: ['题库 → 第 7 章。'] },
    { kind: 'exercise', title: '编程练习', body: ['代码练习 → p-mystrlen：手写字符串长度。'] },
  ],
};

export { CH02, CH03, CH04, CH05, CH06, CH07 };

/** 导出 ch02-07 的章节内容类型（供汇总） */
export type LinearChapter = Chapter & { sections: Section[] };
