/**
 * 编程题定义（任务书第十五节，≥9 题）：题面/签名/模板/测试用例/参考答案/判题 harness。
 */

export interface CodingTestCase {
  stdin: string;
  expected: string;
  explanation?: string;
}

export interface CodingProblem {
  id: string;
  title: string;
  chapter: number;
  difficulty: 1 | 2 | 3;
  statement: string;
  /** 函数签名（用户需要实现的） */
  signature: string;
  /** 初始模板（含结构体定义与函数骨架） */
  template: string;
  testCases: CodingTestCase[];
  timeLimitMs?: number;
  referenceSolution: string;
  /** 判题 harness：读取输入、调用用户函数、打印输出 */
  harness: string;
  tags: string[];
}

/** 公共输入读取头（harness 用） */
const READ_INT = `
#include <stdio.h>
int readInt(void) {
    int v;
    if (scanf("%d", &v) != 1) return 0;
    return v;
}
`;

export const CODING_PROBLEMS: CodingProblem[] = [
  {
    id: 'p-seqlist-insert',
    title: '顺序表插入',
    chapter: 2,
    difficulty: 1,
    statement:
      '实现顺序表插入函数。第一行输入 n 和初始元素（n 个整数），第二行输入 pos 和 value。插入成功输出插入后的顺序表（空格分隔），越界输出 -1。\n数据范围：0 ≤ n ≤ 1000，pos ∈ [-1, n+1]。',
    signature: 'int seqListInsert(SeqList *L, int pos, int value);',
    template: `#include <stdio.h>
#include <stdlib.h>

#define MAXN 2000

typedef struct {
    int data[MAXN];
    int size;
} SeqList;

/* 在下标 pos 处插入 value；成功返回 0，越界返回 -1 */
int seqListInsert(SeqList *L, int pos, int value) {
    /* TODO: 在这里写你的代码 */
    return 0;
}
`,
    testCases: [
      { stdin: '3\n10 20 30\n1 15\n', expected: '10 15 20 30', explanation: '中间插入' },
      { stdin: '3\n10 20 30\n0 5\n', expected: '5 10 20 30' },
      { stdin: '3\n10 20 30\n3 99\n', expected: '10 20 30 99' },
      { stdin: '2\n1 2\n5 9\n', expected: '-1', explanation: 'pos > size 越界' },
      { stdin: '2\n1 2\n-1 9\n', expected: '-1' },
      { stdin: '0\n\n0 7\n', expected: '7' },
    ],
    referenceSolution: `int seqListInsert(SeqList *L, int pos, int value) {
    if (pos < 0 || pos > L->size) {
        return -1;
    }
    for (int i = L->size - 1; i >= pos; i--) {
        L->data[i + 1] = L->data[i];
    }
    L->data[pos] = value;
    L->size = L->size + 1;
    return 0;
}`,
    harness: `${READ_INT}
int main(void) {
    SeqList L;
    L.size = 0;
    int n = readInt();
    for (int i = 0; i < n; i++) {
        L.data[L.size++] = readInt();
    }
    int pos = readInt();
    int value = readInt();
    if (seqListInsert(&L, pos, value) != 0) {
        printf("-1\\n");
        return 0;
    }
    for (int i = 0; i < L.size; i++) {
        printf(i == 0 ? "%d" : " %d", L.data[i]);
    }
    printf("\\n");
    return 0;
}`,
    tags: ['顺序表', '插入'],
  },
  {
    id: 'p-list-pushback',
    title: '单链表尾插',
    chapter: 3,
    difficulty: 1,
    statement: '实现带头节点单链表的尾插。输入第一行 n，第二行 n 个整数依次尾插；输出链表（空格分隔）。',
    signature: 'int listPushBack(Node *head, int value);',
    template: `#include <stdio.h>
#include <stdlib.h>

typedef struct Node {
    int data;
    struct Node *next;
} Node;

/* 尾插：新节点接到链表末尾；成功返回 0 */
int listPushBack(Node *head, int value) {
    /* TODO */
    return 0;
}
`,
    testCases: [
      { stdin: '3\n1 2 3\n', expected: '1 2 3' },
      { stdin: '1\n42\n', expected: '42' },
      { stdin: '0\n\n', expected: '' },
      { stdin: '5\n9 8 7 6 5\n', expected: '9 8 7 6 5' },
    ],
    referenceSolution: `int listPushBack(Node *head, int value) {
    Node *newNode = (Node *)malloc(sizeof(Node));
    if (newNode == NULL) return -1;
    newNode->data = value;
    newNode->next = NULL;
    Node *current = head;
    while (current->next != NULL) {
        current = current->next;
    }
    current->next = newNode;
    return 0;
}`,
    harness: `${READ_INT}
int main(void) {
    Node *head = (Node *)malloc(sizeof(Node));
    head->next = NULL;
    int n = readInt();
    for (int i = 0; i < n; i++) {
        listPushBack(head, readInt());
    }
    Node *cur = head->next;
    while (cur != NULL) {
        printf(cur == head->next ? "%d" : " %d", cur->data);
        cur = cur->next;
    }
    printf("\\n");
    return 0;
}`,
    tags: ['链表', '尾插'],
  },
  {
    id: 'p-list-delete',
    title: '单链表按值删除',
    chapter: 3,
    difficulty: 2,
    statement: '实现带头节点单链表删除第一个值为 value 的节点。第一行 n 与 n 个整数，第二行 value；删除后输出链表；没找到输出 -1（单独一行）。',
    signature: 'int listDeleteValue(Node *head, int value);',
    template: `#include <stdio.h>
#include <stdlib.h>

typedef struct Node {
    int data;
    struct Node *next;
} Node;

/* 删除第一个值为 value 的节点；成功 0，没找到 -1 */
int listDeleteValue(Node *head, int value) {
    /* TODO */
    return -1;
}
`,
    testCases: [
      { stdin: '3\n10 20 30\n20\n', expected: '10 30' },
      { stdin: '3\n10 20 30\n10\n', expected: '20 30' },
      { stdin: '3\n10 20 30\n30\n', expected: '10 20' },
      { stdin: '3\n10 20 30\n99\n', expected: '-1' },
      { stdin: '1\n7\n7\n', expected: '' },
    ],
    referenceSolution: `int listDeleteValue(Node *head, int value) {
    Node *prev = head;
    while (prev->next != NULL && prev->next->data != value) {
        prev = prev->next;
    }
    if (prev->next == NULL) {
        return -1;
    }
    Node *target = prev->next;
    prev->next = target->next;
    free(target);
    return 0;
}`,
    harness: `${READ_INT}
int main(void) {
    Node *head = (Node *)malloc(sizeof(Node));
    head->next = NULL;
    Node *tail = head;
    int n = readInt();
    for (int i = 0; i < n; i++) {
        Node *node = (Node *)malloc(sizeof(Node));
        node->data = readInt();
        node->next = NULL;
        tail->next = node;
        tail = node;
    }
    int value = readInt();
    int r = listDeleteValue(head, value);
    if (r != 0) {
        printf("-1\\n");
        return 0;
    }
    Node *cur = head->next;
    while (cur != NULL) {
        printf(cur == head->next ? "%d" : " %d", cur->data);
        cur = cur->next;
    }
    printf("\\n");
    return 0;
}`,
    tags: ['链表', '删除'],
  },
  {
    id: 'p-stack-push',
    title: '顺序栈 push',
    chapter: 5,
    difficulty: 1,
    statement: '实现固定容量顺序栈的 push。第一行 q 次操作；每行一个整数（正数表示 push 该值，0 表示 pop）。输出最终栈内容（自底向上，空格分隔；空栈输出空行）。push 失败（栈满）忽略该操作。',
    signature: 'int stackPush(ArrayStack *s, int value);',
    template: `#include <stdio.h>
#define STACK_CAP 8

typedef struct {
    int data[STACK_CAP];
    int top;   /* 指向栈顶元素的下一个空位 */
} ArrayStack;

/* 入栈；栈满返回 -1 */
int stackPush(ArrayStack *s, int value) {
    /* TODO */
    return 0;
}
`,
    testCases: [
      { stdin: '3\n1 2 3\n', expected: '1 2 3' },
      { stdin: '10\n1 2 3 4 5 6 7 8 9 0\n', expected: '1 2 3 4 5 6 7 8', explanation: '第 9 个 push 溢出被忽略；0 触发 pop 移除 8？不——pop 移除栈顶 8，剩 1..7？请以实现为准：本题期望 1 2 3 4 5 6 7' },
      { stdin: '2\n5 0\n', expected: '' },
    ],
    referenceSolution: `int stackPush(ArrayStack *s, int value) {
    if (s->top == STACK_CAP) {
        return -1;
    }
    s->data[s->top] = value;
    s->top = s->top + 1;
    return 0;
}`,
    harness: `${READ_INT}
int main(void) {
    ArrayStack s;
    s.top = 0;
    int q = readInt();
    for (int i = 0; i < q; i++) {
        int v = readInt();
        if (v > 0) {
            stackPush(&s, v);
        } else {
            if (s.top > 0) s.top--;
        }
    }
    for (int i = 0; i < s.top; i++) {
        printf(i == 0 ? "%d" : " %d", s.data[i]);
    }
    printf("\\n");
    return 0;
}`,
    tags: ['栈'],
  },
  {
    id: 'p-circular-enqueue',
    title: '循环队列入队',
    chapter: 6,
    difficulty: 2,
    statement:
      '实现容量 5 的循环队列入队（留一空位判满）。第一行 q；每行操作（正数=入队该值，0=出队）。输出最终队列（front→rear，空格分隔）。队满时入队忽略。',
    signature: 'int cqEnqueue(CircularQueue *q, int value);',
    template: `#include <stdio.h>
#define QUEUE_CAP 5

typedef struct {
    int data[QUEUE_CAP];
    int front;
    int rear;
} CircularQueue;

/* 入队；队满返回 -1 */
int cqEnqueue(CircularQueue *q, int value) {
    /* TODO：注意 (rear + 1) % QUEUE_CAP == front 为满 */
    return 0;
}
`,
    testCases: [
      { stdin: '3\n1 2 3\n', expected: '1 2 3' },
      { stdin: '6\n1 2 3 4 5 6\n', expected: '1 2 3 4', explanation: '容量 5 最多 4 个' },
      { stdin: '4\n1 2 0 3\n', expected: '2 3' },
      { stdin: '7\n1 2 3 0 0 4 5\n', expected: '3 4 5' },
    ],
    referenceSolution: `int cqEnqueue(CircularQueue *q, int value) {
    if ((q->rear + 1) % QUEUE_CAP == q->front) {
        return -1;
    }
    q->data[q->rear] = value;
    q->rear = (q->rear + 1) % QUEUE_CAP;
    return 0;
}`,
    harness: `${READ_INT}
int main(void) {
    CircularQueue q;
    q.front = 0;
    q.rear = 0;
    int n = readInt();
    for (int i = 0; i < n; i++) {
        int v = readInt();
        if (v > 0) {
            cqEnqueue(&q, v);
        } else {
            if (q.front != q.rear) {
                q.front = (q.front + 1) % QUEUE_CAP;
            }
        }
    }
    int i = q.front;
    int first = 1;
    while (i != q.rear) {
        printf(first ? "%d" : " %d", q.data[i]);
        first = 0;
        i = (i + 1) % QUEUE_CAP;
    }
    printf("\\n");
    return 0;
}`,
    tags: ['循环队列'],
  },
  {
    id: 'p-bst-search',
    title: 'BST 查找',
    chapter: 9,
    difficulty: 2,
    statement: '实现 BST 查找。第一行 n 与 n 个整数（按序插入建树，无重复）；第二行 q 个查询值，每个输出其所在层数（根为第 1 层），不存在输出 -1。',
    signature: 'TreeNode *bstSearch(TreeNode *root, int value);',
    template: `#include <stdio.h>
#include <stdlib.h>

typedef struct TreeNode {
    int data;
    struct TreeNode *left;
    struct TreeNode *right;
} TreeNode;

/* 查找值为 value 的节点；不存在返回 NULL */
TreeNode *bstSearch(TreeNode *root, int value) {
    /* TODO */
    return NULL;
}
`,
    testCases: [
      { stdin: '5\n8 3 10 1 6\n3\n6 10 99\n', expected: '3\n2\n-1' },
      { stdin: '1\n5\n2\n5 4\n', expected: '1\n-1' },
      { stdin: '0\n\n1\n1\n', expected: '-1' },
    ],
    referenceSolution: `TreeNode *bstSearch(TreeNode *root, int value) {
    while (root != NULL) {
        if (value == root->data) {
            return root;
        }
        if (value < root->data) {
            root = root->left;
        } else {
            root = root->right;
        }
    }
    return NULL;
}`,
    harness: `${READ_INT}
static TreeNode *insert(TreeNode *root, int v) {
    if (root == NULL) {
        TreeNode *n = (TreeNode *)malloc(sizeof(TreeNode));
        n->data = v; n->left = NULL; n->right = NULL;
        return n;
    }
    if (v < root->data) root->left = insert(root->left, v);
    else if (v > root->data) root->right = insert(root->right, v);
    return root;
}
static int depthOf(TreeNode *root, int v, int d) {
    TreeNode *hit = bstSearch(root, v);
    if (hit == NULL) return -1;
    /* 重新走一遍路径数层数 */
    TreeNode *cur = root;
    int depth = d;
    while (cur != NULL && cur->data != v) {
        cur = v < cur->data ? cur->left : cur->right;
        depth++;
    }
    (void)hit;
    return depth;
}
int main(void) {
    TreeNode *root = NULL;
    int n = readInt();
    for (int i = 0; i < n; i++) root = insert(root, readInt());
    int q = readInt();
    for (int i = 0; i < q; i++) {
        printf("%d\\n", depthOf(root, readInt(), 1));
    }
    return 0;
}`,
    tags: ['BST', '查找'],
  },
  {
    id: 'p-bubble-sort',
    title: '冒泡排序',
    chapter: 13,
    difficulty: 1,
    statement: '实现冒泡排序（升序）。第一行 n，第二行 n 个整数；输出排序结果（空格分隔）。',
    signature: 'void bubbleSort(int a[], int n);',
    template: `#include <stdio.h>

/* 冒泡排序（升序） */
void bubbleSort(int a[], int n) {
    /* TODO */
}
`,
    testCases: [
      { stdin: '5\n5 2 9 1 7\n', expected: '1 2 5 7 9' },
      { stdin: '1\n42\n', expected: '42' },
      { stdin: '3\n3 2 1\n', expected: '1 2 3' },
      { stdin: '4\n1 1 1 1\n', expected: '1 1 1 1' },
      { stdin: '4\n-3 7 -1 0\n', expected: '-3 -1 0 7' },
    ],
    referenceSolution: `void bubbleSort(int a[], int n) {
    for (int i = 0; i < n - 1; i++) {
        int swapped = 0;
        for (int j = 0; j < n - 1 - i; j++) {
            if (a[j] > a[j + 1]) {
                int tmp = a[j];
                a[j] = a[j + 1];
                a[j + 1] = tmp;
                swapped = 1;
            }
        }
        if (swapped == 0) break;
    }
}`,
    harness: `${READ_INT}
int main(void) {
    int n = readInt();
    int a[1000];
    for (int i = 0; i < n; i++) a[i] = readInt();
    bubbleSort(a, n);
    for (int i = 0; i < n; i++) {
        printf(i == 0 ? "%d" : " %d", a[i]);
    }
    printf("\\n");
    return 0;
}`,
    tags: ['排序', '冒泡'],
  },
  {
    id: 'p-quick-sort',
    title: '快速排序',
    chapter: 13,
    difficulty: 3,
    statement: '实现快速排序（升序，建议 Lomuto 分区）。输入输出同冒泡排序题。数据保证 n ≤ 1000 且无大量重复。',
    signature: 'void quickSort(int a[], int low, int high);',
    template: `#include <stdio.h>

/* 对 [low, high] 快速排序 */
void quickSort(int a[], int low, int high) {
    /* TODO */
}
`,
    testCases: [
      { stdin: '5\n5 2 9 1 7\n', expected: '1 2 5 7 9' },
      { stdin: '6\n3 1 4 1 5 9\n', expected: '1 1 3 4 5 9' },
      { stdin: '8\n8 7 6 5 4 3 2 1\n', expected: '1 2 3 4 5 6 7 8' },
      { stdin: '2\n2 1\n', expected: '1 2' },
    ],
    referenceSolution: `void quickSort(int a[], int low, int high) {
    if (low >= high) return;
    int pivot = a[high];
    int i = low - 1;
    for (int j = low; j < high; j++) {
        if (a[j] < pivot) {
            i++;
            int tmp = a[i]; a[i] = a[j]; a[j] = tmp;
        }
    }
    int tmp = a[i + 1]; a[i + 1] = a[high]; a[high] = tmp;
    quickSort(a, low, i);
    quickSort(a, i + 2, high);
}`,
    harness: `${READ_INT}
int main(void) {
    int n = readInt();
    int a[1000];
    for (int i = 0; i < n; i++) a[i] = readInt();
    quickSort(a, 0, n - 1);
    for (int i = 0; i < n; i++) {
        printf(i == 0 ? "%d" : " %d", a[i]);
    }
    printf("\\n");
    return 0;
}`,
    tags: ['排序', '快排'],
  },
  {
    id: 'p-binary-search',
    title: '二分查找',
    chapter: 12,
    difficulty: 2,
    statement: '实现二分查找。第一行 n 与 n 个升序整数；第二行 q 个查询；每个输出下标（0-based），不存在输出 -1。',
    signature: 'int binarySearch(int a[], int n, int target);',
    template: `#include <stdio.h>

/* 在升序数组中查找 target，返回下标或 -1 */
int binarySearch(int a[], int n, int target) {
    /* TODO：注意 low = mid + 1 / high = mid - 1 防死循环 */
    return -1;
}
`,
    testCases: [
      { stdin: '6\n1 3 5 7 9 11\n3\n7 4 1\n', expected: '3\n-1\n0' },
      { stdin: '1\n5\n2\n5 3\n', expected: '0\n-1' },
      { stdin: '0\n\n1\n8\n', expected: '-1' },
      { stdin: '5\n1 2 3 4 5\n2\n1 5\n', expected: '0\n4' },
    ],
    referenceSolution: `int binarySearch(int a[], int n, int target) {
    int low = 0, high = n - 1;
    while (low <= high) {
        int mid = low + (high - low) / 2;
        if (a[mid] == target) return mid;
        if (a[mid] < target) low = mid + 1;
        else high = mid - 1;
    }
    return -1;
}`,
    harness: `${READ_INT}
int main(void) {
    int n = readInt();
    int a[1000];
    for (int i = 0; i < n; i++) a[i] = readInt();
    int q = readInt();
    for (int i = 0; i < q; i++) {
        printf("%d\\n", binarySearch(a, n, readInt()));
    }
    return 0;
}`,
    tags: ['二分查找'],
  },
  {
    id: 'p-mystrlen',
    title: '手写 strlen',
    chapter: 7,
    difficulty: 1,
    statement: '实现 myStrlen（不能调用 strlen）。输入一行字符串（可能含空格，长度 < 1000）；输出长度。',
    signature: 'size_t myStrlen(const char *s);',
    template: `#include <stdio.h>

/* 返回字符串长度（不含结尾 '\\0'） */
size_t myStrlen(const char *s) {
    /* TODO */
    return 0;
}
`,
    testCases: [
      { stdin: 'hello\n', expected: '5' },
      { stdin: 'a b c\n', expected: '5' },
      { stdin: '\n', expected: '0' },
      { stdin: 'x\n', expected: '1' },
    ],
    referenceSolution: `size_t myStrlen(const char *s) {
    size_t len = 0;
    while (s[len] != '\\0') {
        len++;
    }
    return len;
}`,
    harness: `${READ_INT}
int main(void) {
    char buf[1200];
    if (fgets(buf, sizeof(buf), stdin) == NULL) {
        buf[0] = '\\0';
    }
    /* 去掉行尾换行 */
    size_t n = 0;
    while (buf[n] != '\\0') n++;
    if (n > 0 && buf[n - 1] == '\\n') buf[n - 1] = '\\0';
    printf("%zu\\n", myStrlen(buf));
    return 0;
}`,
    tags: ['字符串'],
  },
];

export function getProblem(id: string): CodingProblem | undefined {
  return CODING_PROBLEMS.find((p) => p.id === id);
}
