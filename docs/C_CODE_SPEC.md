# C_CODE_SPEC.md — C 代码教学规范

## 1. 代码风格（初学者友好）

- 一律 C99/C11 兼容；不用复杂宏、不用 `typedef` 花活、不炫技。
- 命名：结构体 `PascalCase`（`SeqList`/`TreeNode`），函数与变量 `snake_case`。
- 结构化写法：大括号独立成行（教学一致性，避免 K&R 风格分心）。
- 每个文件头部注释：模块用途 + 依赖（如 `<stdlib.h>` 的 malloc/free）。
- 关键行必须有中文注释；注释解释"为什么"，不复述语法。
- 错误处理显式：malloc 失败检查 `if (p == NULL) { ... return; }`。
- 每个教学程序结尾演示 `free()` 全部堆内存（`destroy` 函数）。

## 2. 逐行解释格式（`content/` 中以结构化数据存放）

```ts
interface CodeLine {
  text: string;            // C 源码行
  note?: string;           // 行级解释（悬浮显示）
  beginner?: string;       // 新手模式更详细解释
}
interface CProgram {
  id: string;              // 如 "linked-list-insert"
  title: string;
  lines: CodeLine[];
}
```

示例（单链表插入核心行）：
`Node *newNode = malloc(sizeof(Node));`
note：`malloc 向系统申请一块能装下一个 Node 的内存，返回起始地址；sizeof(Node) 保证大小正确。`
beginner：`Node 由 int data(4字节) 和 指针 next(8字节) 组成……若不检查返回值，内存不足时后续会对 NULL 解引用导致崩溃。`

## 3. 每章必须提供的教学 C 代码清单

| 章 | CProgram（至少） |
| --- | --- |
| Ch0 | struct 定义与使用 / typedef / 指针与解引用 / 指针与数组 / malloc+free / 递归阶乘 / sizeof 演示 |
| Ch1 | 常见复杂度代码示例（O(1)/O(n)/O(log n)/O(n²) 各一） |
| Ch2 | seqlist 完整实现（init/insert/delete/find/set/traverse/grow/destroy） |
| Ch3 | 单链表完整实现（含头节点；头插/尾插/定位插/删/查找/遍历/destroy） |
| Ch4 | 双向链表（插入四步/删除/双向遍历） |
| Ch5 | 顺序栈 / 链栈 / 括号匹配 /（思想讲解：表达式求值、递归栈） |
| Ch6 | 循环队列（(rear+1)%capacity）/ 链队列 / 顺序队列假溢出演示 |
| Ch7 | 一维/二维数组与字符串、strlen/strcpy 手写、内存布局图解 |
| Ch8 | 二叉树定义与四种遍历（递归 + 队列层序） |
| Ch9 | BST insert/search/delete（三情形全覆盖） |
| Ch10 | Max/Min 堆（insert/delete/heapify）+ heap sort |
| Ch11 | 邻接矩阵/邻接表 + DFS/BFS |
| Ch12 | 顺序查找 / 二分查找（含有序前提断言） |
| Ch13 | 7 种排序完整实现（含注释与复杂度标注） |

## 4. 与可视化步骤的一致性

- 每个可动画操作声明其 `CProgram.id`；`Step.codeLine` 指向该程序行号（1-based）。
- 步骤生成器中的每个关键动作必须能映射到 C 代码行；纯 UI 性步骤（如"高亮已排序区"）codeLine 允许指向其逻辑来源行。
- 测试：`codeLine` 越界即失败；核心操作（插入/删除/遍历）至少有一条 Step 映射到含 `->next` 或等价指针操作的行。

## 5. 内存教学约定

- 展示地址一律为**模拟地址**（0x1000 起，按对象大小对齐递增），UI 标注"模拟地址，非真实内存"。
- 每次 malloc/free 在内存面板有对应行；free 后该地址标灰并注 `已释放`；强调 use-after-free 与忘记 free（泄漏）两种错误。
