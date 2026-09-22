# DATA_STRUCTURE_SPEC.md — 数据结构规格

统一约定：
- 所有模块位于 `src/core/data-structures/`，纯 TS，零 UI 依赖。
- 每个操作两种形态：`xxxDirect()`（纯逻辑，供算法复用/测试）与 `xxx()` 步骤版（内部走 Direct，同时通过 `StepRecorder` 记录 Step[]）。
- 所有"删除/释放"类操作必须记录内存释放步骤（`free` 语义），体现 C 内存观。
- 语义与 C 实现一致：失败返回错误码/Result，不抛异常模拟 C 风格（内部类型安全）。

## 1. 顺序表 SeqList

```c
typedef struct {
    int *data;      // 指向堆上数组
    int size;       // 当前元素个数
    int capacity;   // 容量
} SeqList;
```

操作：init / pushBack / insertAt / deleteAt / find / set / traverse / grow（扩容 ×2）/ destroy。
约束：`0 <= index <= size`；满则先扩容再插入；扩容必须生成"申请新内存→搬移→释放旧内存"步骤。

## 2. 单链表 SinglyLinkedList（带头节点）

```c
typedef struct Node {
    int data;
    struct Node *next;
} Node;
```

操作：initHead / pushFront / pushBack / insertAt / deleteAt / deleteValue / find / set / traverse / destroy。
指针变量（须作为 Step.variables 展示）：`head`、`current`、`prev`、`newNode`。
插入必须分步：① 创建 newNode ② `newNode->next = current->next` ③ `current->next = newNode`。顺序颠倒 = 经典断链错误，须在"常见错误"演示。

## 3. 双向链表 DoublyLinkedList（带头节点）

```c
typedef struct DNode {
    int data;
    struct DNode *prev;
    struct DNode *next;
} DNode;
```

操作：initHead / pushFront / pushBack / insertAfter / deleteAt / traverseForward / traverseBackward / destroy。
插入四步：`newNode->prev=p; newNode->next=p->next; p->next->prev=newNode; p->next=newNode;`（每步一条 Step，展示 prev/next 双向箭头变化）。

## 4. 栈 Stack

顺序栈（数组实现，top 为栈顶下标或指向下一空位——**采用 top=下一空位约定**，教学中显式说明）与链栈（头插/头删）。
操作：push / pop / top(peek) / isEmpty / isFull(顺序栈)。
应用演示：括号匹配（逐步展示栈内容与当前字符）、表达式求值思想（中缀→后缀示意）、递归调用栈（配合树遍历）。

## 5. 队列 Queue

- 顺序队列（演示假溢出）→ 循环队列：`front`、`rear`、`(rear+1)%capacity`、判满（留一空位法）、判空（front==rear）。
- 链队列：front/rear 指针节点。
操作：enqueue / dequeue / getFront / getRear / isEmpty / isFull。
循环队列 wrap-around 必须有专门可视化步骤（rear 从 capacity-1 回绕到 0）。

## 6. 二叉树 BinaryTree / 二叉搜索树 BST

```c
typedef struct TreeNode {
    int data;
    struct TreeNode *left;
    struct TreeNode *right;
} TreeNode;
```

- BinaryTree：build（含 NULL 占位语义说明）、insertLeft/Right（教学用）、四种遍历 preorder/inorder/postorder（递归版，Step 含 CallStack 帧压栈/出栈）/ levelOrder（队列辅助，Step 展示队列内容）。
- BST：insert / search / delete。
  Delete 三情形（必须有完整步骤与图示）：
  ① 叶节点：父指针置 NULL，free；
  ② 单子节点：父指针绕过（bypass）指向其子，free；
  ③ 双子节点：用中序前驱（左子树最大）或后继值替换，转为删除前驱/后继节点。
  v1.0 采用**中序前驱**方案并在文档/课程中说明理由。

## 7. 堆 Heap

数组实现（0-based），Max/Min 两种比较器。
操作：insert（上滤 sift-up）/ deleteTop（下滤 sift-down）/ heapify（自底向上建堆，Floyd）/ heapSort。
约束：每步维护堆性质，Step 记录交换与父子下标关系（`parent=(i-1)/2`、`children=2i+1,2i+2`）。

## 8. 图 Graph

邻接矩阵 + 邻接表两种内部表示（可切换展示）。
操作：addNode / removeNode / addEdge / removeEdge（无向/有向）/ dfs（递归栈展示）/ bfs（队列展示）。
Step 须标记：visited 集合、current node、next node（正在考察的邻居）、 frontier（栈/队列内容）。

## 9. 查找与排序（`src/core/algorithms/`）

- search：linearSearch、binarySearch（前提：有序；每步展示 lo/hi/mid 与排除区间）。
  **二分查找重复值规范（P15 裁决）**：命中即返回，重复值场景返回**某个**匹配下标（any-match），
  不做首/末匹配强约束。一致性验证用 `idx === -1 ⇔ 不存在` 且 `idx ≥ 0 ⇒ a[idx] === target`
  （见 DIFFERENTIAL_TEST_SPEC §7；差分测试据此比较）。
- sorting：bubble / selection / insertion / shell / merge / quick / heap。
  每个 Step 附带：数组状态、compare 区间、swap 对、已排序区、pivot、merge 区间、`comparisons`/`swaps` 计数器。
  排序同时提供"纯函数版"（供测试对照）与"步骤版"。

## 10. 模拟内存模型（教学）

- `SimulatedMemory`：分配计数器生成**模拟地址**（如 `0x1000` 起步、8 字节对齐递增），仅教学展示，UI 必须标注"模拟地址"。
- 每个节点/数组分配记录：`{变量名, 地址, 值, 类型}`；指针变量的"值"= 指向对象的模拟地址；释放后地址标记 freed（dangling 演示可标注，但不复用已释放地址）。
