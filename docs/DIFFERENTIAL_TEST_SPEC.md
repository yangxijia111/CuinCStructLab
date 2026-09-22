# Differential Test Specification

> P15 配套规格。定义"教学 C 代码 ↔ TS Core"语义级差分测试的模型、C Harness 输出协议、语义归一化与随机测试规范。
> 状态：实施中（P15-B/C）。

## 1. 目标

对同一输入与同一操作序列，**TypeScript Core 的最终语义状态**与**真实编译执行的 C 实现**必须一致。差分的 C 侧不是另写一套参考实现，而是**项目自身的教学 C 代码**（各模块 `XXX_C_CODE` 常量）——验证的正是产品对用户展示的两套表述（可视化 TS 逻辑 vs 教学 C 代码）的语义一致性。

## 2. 模型

```
DifferentialCase {
  structure: StructureId
  seed: number                    // 可复现
  initialState: JSON（结构相关：values/capacity/edges...）
  operations: Operation[]         // { op: string, args: number[] }
  expectedSemanticState?: SemanticState   // 定向用例可给；随机用例省略（TS/C 互为 oracle）
}

Operation = { op: string, args: (number|string)[] }
```

流水线：`OperationSequence → TS Executor → SemanticState ─┐`
`OperationSequence → C Harness Generator → 源码 → 编译 → 运行 → 解析 STATE 行 → SemanticState ─┴→ Compare（canonical JSON 深比较）`

统一入口 `runDifferentialSuite(suite, { compiler, execC })`；差分逻辑不硬编码在各 test 文件，test 只声明结构与规模。

## 3. 语义归一化（Semantic Normalization）

**禁止比较**：内存地址、节点 ID（`n0/n1…`）、模拟地址（`0x8000…`）、真实 malloc 指针值。

**语义状态投影**（canonical 形式，比较用 JSON.stringify 后 deepEqual）：

| 结构 | SemanticState |
|---|---|
| 顺序表/链表/双向链表 | `{ kind:'list', values:number[], size:number }`；双向另加 `backward:number[]` |
| 栈 | `{ kind:'stack', bottomToTop:number[], size:number, lastOpReturn:number }` |
| 循环队列 | `{ kind:'queue', values:number[], size:number, full:0\|1, empty:0\|1 }`（values = 逻辑队首→队尾序列，不比较 front/rear 下标） |
| BST | `{ kind:'bst', inorder:number[] }` |
| Heap | `{ kind:'heap', values:number[], size:number, heapProperty:0\|1 }` |
| Graph | `{ kind:'graph', order:number[] }`（DFS/BFS 访问序列；邻接访问顺序双方固定为"顶点编号升序"，消除多解） |
| 排序 | `{ kind:'array', values:number[] }` |
| 二分查找 | `{ kind:'search', foundIndex:number }`（返回第一个匹配下标，见 §7） |

C 侧同一投影由 Harness 直接打印；TS 侧复用 core 的语义提取函数（`seqListValues`/`listValues`/`bstInorder`/`heapValues`…）。

## 4. C Harness 输出协议（机器可解析）

每 case 在 C 侧输出一个**行块**，行格式 `TAG:value`，不依赖肉眼：

```
BEGIN <caseIndex>
S:[10,15,30]          # 主语义序列（list/array/stack/queue/heap）
SIZE:3
BWD:[30,15,10]        # 双向链表 backward（可选 tag）
FULL:0 EMPTY:1        # 队列（可选 tag）
HEAPOK:1              # 堆性质校验（可选 tag）
ORDER:[2,0,1,3]       # 图遍历序列（可选 tag）
IN:[50,30,70]         # BST 中序（可选 tag）
IDX:4                 # 查找返回下标（可选 tag）
END <caseIndex>
```

- 数组元素以 `,` 分隔，空序列为 `[]`。整数一律十进制。
- 解析器逐行读取 tag 构建 SemanticState；未知 tag 忽略（向前兼容）。
- 出现 `ABORT:<reason>` 行视为 C 侧执行异常（差分直接失败并展示）。

## 5. C Harness Generator

`src/differential/harness/<structure>.ts` 每结构导出 `generateC(cases): string`：

1. 引入对应教学 C 代码全文（`XXX_C_CODE.join('\n')`）作为被测实现；
2. 生成 `main`：遍历 cases → 执行 `initialState` 构建 + `operations` 调用 → 按 §4 打印语义状态；
3. **多个 case 合并进一个 C 程序**（每 case 独立重建结构），整个结构一次编译，CI 时间可控；
4. 生成代码不使用 VLA、不依赖实现定义行为；溢出/越界等操作在教学实现语义内处理（返回 -1，不改状态）。

示例（链表，`init [10,20,30]` → `insertAt(1,15)` → `deleteValue(20)`）：

```c
/* <教学 LINKED_LIST_C_CODE 全文> */
static void printState(void) {
    printf("S:[");
    for (Node *c = head->next; c != NULL; c = c->next) printf("%s%d", c==head->next?"":",", c->data);
    printf("]\n");
}
int main(void) {
    { /* case 0 */
        printf("BEGIN 0\n");
        listInit();
        listPushBack(10); listPushBack(20); listPushBack(30);
        listInsertAt(1, 15);
        listDeleteValue(20);
        printState();
        printf("END 0\n");
    }
    return 0;
}
```

## 6. 随机 / Property-Based 测试规范

- RNG：`src/differential/rng.ts` 的 mulberry32（32 位 seeded，跨平台确定）；所有随机用例由 `(structure, seed)` 确定，**禁止** `Math.random()`/时间做种子。
- 生成器按结构限制操作合法性（如 pos ∈ [0, size+2] 包含少量越界以验证双方一致的失败语义；值域 [-999, 999]）。
- 规模（最低要求，CI 全量执行）：
  - 单链表 / 双向链表 / 循环队列 / BST / Heap：各 ≥100 轮；每轮随机初始 + 20~100 个操作；
  - 顺序栈：≥100 轮（push/pop/peek 混合，含满/空边界）；
  - 顺序表：≥100 轮（insert/delete/set/find 混合）；
  - 7 种排序：各 ≥100 组输入，分布覆盖：空、单元素、已序、逆序、全重复、负数、随机、大重复率；n ∈ [0, 40]；
  - 二分查找：≥100 组有序数组 × 多目标（存在/不存在/首/末/重复段）；
  - Graph DFS/BFS：定向用例集（连通/非连通/有向/无向/环/孤立点），遍历顺序规范见 §3。
- 失败输出必须包含：seed、initialState、operations（逐条）、TS 语义状态、C 语义状态、首个差异字段（vitest assertion message 呈现，可直接复现）。

## 7. 规范裁决（重复值二分查找）

现状 TS `binarySearchSteps` 与 C `SEARCH_C_CODE` 均为"命中即返回"的经典实现，重复值时返回**任意一个**匹配下标（实现定义）。P15 明确规范为可比语义：

> **SPEC：二分查找在重复值场景的保证为"返回某个匹配下标"（any-match）；`found` 判定用 `a[idx] === target && idx !== -1`，不做首/末匹配强约束。**

差分比较据此实现：TS/C 各得下标 → 双方都须满足 `idx === -1 ⇔ 不存在`，且非 -1 时 `a[idx] === target`（C 侧 Harness 同时打印 `IDX` 与数组以供校验）。该裁决同步记录到 `DATA_STRUCTURE_SPEC.md` 与教学内容说明。

## 8. 目录与职责

```
src/differential/
  types.ts            # Operation/DifferentialCase/SemanticState/StructureId
  rng.ts              # mulberry32 + int/pick/shuffle 工具
  semantic.ts         # SemanticState 构造与 canonical 比较
  executors.ts        # TS 侧执行：结构相关 (state, op) -> state（调用 src/core 真实函数）
  generators.ts       # 随机用例生成（每结构 generateCases(seed, count)）
  harness/
    seqlist.ts linked-list.ts doubly-list.ts stack.ts queue.ts
    bst.ts heap.ts graph.ts sorting.ts binary-search.ts
    shared.ts         # STATE 行打印辅助 C 片段（printState 等）
  node/
    c-exec.ts         # Node 专属：写临时文件→编译→运行→收 stdout（复用 execSafe）
tests/differential/
  <structure>.diff.test.ts   # 定向 + 随机，skipIf 无编译器（CI 强制全量）
```

`src/differential/**`（除 `node/`）不得 import Node API —— 保证可被任意环境复用且不进浏览器 bundle。

## 9. 验收

1. 本 SPEC §6 规模全部落地且 CI（GCC）全绿；
2. Clang 侧同套件全绿（跨编译器一致）；
3. MSVC 侧至少排序/查找/顺序表/栈通过，其余结构若被 MSVC 行为阻塞须记录具体差异证据；
4. 人为注入 TS/C 任一侧缺陷时差分测试必须红（在开发过程中以 mutation 方式自验一次并记录）。
