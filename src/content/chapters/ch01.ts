/**
 * Chapter 1：时间复杂度与空间复杂度。
 */
import type { Chapter, CProgramRef } from '../types';

export const CH01_C_PROGRAMS: CProgramRef[] = [
  {
    id: 'ch01-o1',
    title: 'O(1)：与规模无关',
    lines: [
      '/* 不管 n 多大，都只做固定次数操作 */',
      'int first(int a[], int n) {',
      '    return a[0];        /* 一次访问，O(1) */',
      '}',
    ],
    notes: { 3: '数组下标直达：顺序表随机访问是 O(1) 的原因。' },
  },
  {
    id: 'ch01-on',
    title: 'O(n)：扫一遍',
    lines: [
      '/* 把每个元素看一次 */',
      'int sum(int a[], int n) {',
      '    int total = 0;',
      '    for (int i = 0; i < n; i++) {',
      '        total += a[i];   /* 循环 n 次，O(n) */',
      '    }',
      '    return total;',
      '}',
    ],
    notes: { 5: '线性扫描：顺序查找、遍历都是 O(n)。' },
  },
  {
    id: 'ch01-ologn',
    title: 'O(log n)：每次砍一半',
    lines: [
      '/* 每循环一次，范围减半 */',
      'int pow2(int n) {   /* 计算 2^n，只示范对数级循环 */',
      '    int result = 1;',
      '    while (n > 0) {',
      '        result *= 2;',
      '        n /= 2;          /* n 每次减半：log2(n) 次，O(log n) */',
      '    }',
      '    return result;',
      '}',
    ],
    notes: { 6: '二分查找、平衡树操作都是 O(log n)：n 翻倍只多一次操作。' },
  },
  {
    id: 'ch01-onlogn',
    title: 'O(n log n)：n 次 × 砍一半',
    lines: [
      '/* 外面 n 次，里面每次 log n */',
      'void nLogN(int a[], int n) {',
      '    for (int size = 1; size < n; size *= 2) {      /* log n 轮 */',
      '        for (int i = 0; i < n; i++) {              /* 每轮 n 次 */',
      '            a[i] = a[i] + 1;   /* O(n log n) */',
      '        }',
      '    }',
      '}',
    ],
    notes: { 5: '归并/快排/堆排序的平均水平，也是比较排序的理论下界。' },
  },
  {
    id: 'ch01-on2',
    title: 'O(n²)：两重循环',
    lines: [
      '/* 每对元素都比一次 */',
      'void allPairs(int a[], int n) {',
      '    for (int i = 0; i < n; i++) {',
      '        for (int j = 0; j < n; j++) {',
      '            printf("%d+%d ", a[i], a[j]);  /* n*n 次，O(n²) */',
      '        }',
      '    }',
      '}',
    ],
    notes: { 5: '冒泡/选择/插入排序都是 O(n²)：n 翻倍，时间变 4 倍。' },
  },
];

export const CH01: Chapter = {
  id: 1,
  title: '时间复杂度与空间复杂度',
  subtitle: '用大 O 记号衡量算法快慢',
  keywords: ['复杂度', '大O', 'O(1)', 'O(n)', 'O(log n)', 'O(n log n)', 'O(n²)', '效率', '分析'],
  sections: [
    {
      kind: 'what',
      title: '复杂度是什么',
      body: [
        '复杂度描述**算法的运行时间（或占用空间）如何随数据规模 n 增长**，用大 O 记号表示。',
        '它不关心具体跑了几毫秒（那取决于机器），只关心增长的"形状"：O(n) 的算法数据翻倍时间大致翻倍，O(n²) 的翻倍时间变四倍。',
      ],
    },
    {
      kind: 'why',
      title: '为什么需要',
      bullets: [
        '比较算法优劣的唯一公平方式：与机器、语言无关。',
        '预估规模上限：知道 n=10⁶ 时 O(n²) 必然超时，就不用试了。',
        '面试与考试的必考语言。',
      ],
    },
    {
      kind: 'analogy',
      title: '类比：翻字典找词',
      bullets: [
        'O(1)：已知页码，直接翻到。',
        'O(n)：从头逐页往后找。',
        'O(log n)：二分——从中间翻开，每次排除一半。',
        'O(n²)：每翻一页，都把整本字典再对折检查一遍。',
        'O(n log n)：把字典撕成两半分别翻好再合起来（归并）。',
      ],
    },
    {
      kind: 'diagram',
      title: '增长曲线对比',
      body: [
        '```',
        'n        O(1)   O(log n)   O(n)   O(n log n)   O(n²)',
        '8          1        3        8         24        64',
        '1,024      1       10    1,024     10,240   1,048,576',
        '1,048,576  1       20   ~10⁶     ~2×10⁷    ~10¹² ← 灾难',
        '```',
        'n² 在百万级规模需要约万亿次操作——这就是"大数据必须用 O(n log n) 排序"的原因。',
      ],
      vizOps: [{ op: 'complexity-growth', label: '打开增长曲线动画' }],
    },
    {
      kind: 'struct',
      title: '本章没有新数据结构',
      body: ['复杂度是分析工具，不引入结构定义。'],
    },
    {
      kind: 'operations',
      title: '分析三步法',
      bullets: [
        '① 找基本操作（比较、赋值、访问）。',
        '② 数它执行多少次，用 n 表示。',
        '③ 只保留增长最快的项，丢掉常数和低阶项：3n² + 5n + 7 → O(n²)。',
      ],
    },
    {
      kind: 'code',
      title: '五种常见复杂度的代码形态',
      body: ['右侧代码面板展示 5 段代码（O(1)/O(n)/O(log n)/O(n log n)/O(n²)），每段注释了原因：'],
      codeId: 'ch01-on2',
    },
    {
      kind: 'animation',
      title: '动画：眼见为实',
      vizOps: [
        { op: 'complexity-growth', label: '增长曲线对比动画' },
        { op: 'sort-run', preset: { algo: 'bubble' }, label: '冒泡 O(n²) 跑 16 个元素' },
        { op: 'sort-run', preset: { algo: 'merge' }, label: '归并 O(n log n) 跑 16 个元素' },
      ],
    },
    {
      kind: 'step',
      title: '单步观察比较次数',
      bullets: [
        '在排序动画中打开计数器，单步观察"比较次数"如何随趟数增长。',
        '冒泡：第 1 趟 n-1 次比较，共约 n²/2 次。',
        '归并：每层共 n 次比较，共 log n 层。',
      ],
    },
    {
      kind: 'time',
      title: '常见操作复杂度速查',
      table: {
        headers: ['操作', '顺序表', '链表', 'BST（平衡）', '哈希表*'],
        rows: [
          ['按下标访问', 'O(1)', 'O(n)', '—', '—'],
          ['头部插入', 'O(n)', 'O(1)', '—', '—'],
          ['尾部插入', 'O(1) 摊还', 'O(n) / O(1)带尾指针', '—', '—'],
          ['查找值', 'O(n)', 'O(n)', 'O(log n)', 'O(1) 平均'],
          ['插入值', 'O(n)', 'O(n)+O(1)接入', 'O(log n)', 'O(1) 平均'],
        ],
      },
      body: ['*哈希表超出本书范围，列出仅供对照。'],
    },
    {
      kind: 'space',
      title: '空间复杂度',
      bullets: [
        'O(1)：原地排序（冒泡/选择/插入/堆）。',
        'O(n)：归并排序需要临时数组。',
        'O(log n)：快排的递归栈（平均）。',
        '注意：递归深度本身就是空间开销。',
      ],
    },
    {
      kind: 'pitfalls',
      title: '常见错误',
      bullets: [
        '把"循环层数"当复杂度：两重循环也可能 O(n log n)（外层 ×2 内层 n）。',
        '忘记递归的隐含成本：递归深度就是栈空间。',
        '混淆最好/最坏/平均：快排平均 O(n log n)，最坏 O(n²)。',
        '常数也想比较：大 O 故意忽略常数，O(2n) 就是 O(n)。',
      ],
    },
    {
      kind: 'quiz',
      title: '小测验',
      body: ['到题库 → 第 1 章做复杂度判断题。'],
    },
    {
      kind: 'exercise',
      title: '编程练习',
      body: ['分析你写的每一个函数的复杂度——这是习惯，不是一次性的题。'],
    },
  ],
};
