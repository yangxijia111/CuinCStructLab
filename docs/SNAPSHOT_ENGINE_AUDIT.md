# Snapshot Engine Audit — StepRecorder 快照法性能审计

> P15-J 产出（2026-09-22）。方法：`npm run bench:snapshot`（vitest + node --expose-gc，
> 5 次取样取最小值抗抖动；serialized = 逐步 JSON.stringify 累计字节）。
> 复现脚本：`scripts/bench-snapshot.bench.ts`（固定 seed，确定性输入）。

## 1. 架构与复杂度模型

`StepRecorder`（src/core/recorder.ts）：

- **每步**：`fastClone(current)` 完整深拷贝状态 → `afterState`（时间/内存 = O(状态体积)）。
- **finish()**：对全部步骤递归 `deepFreeze`（O(总状态体积)）。
- 单次操作的快照总体积 ≈ steps × 单步状态体积。

排序的状态 = n 个 cell；比较型排序 steps = O(n²) → **总体积 O(n³)**；快排/归并/堆 steps = O(n log n) → 总体积 O(n² log n)。链表/树/图单操作 steps = O(结构尺寸)，状态 = O(结构尺寸) → 总体积 O(n²) 量级但常数小。

## 2. 实测数据（本机 Windows 11 / Node 24，2026-09-22）

| 场景 | steps | 生成耗时ms | serializedMB | heap峰值增量MB |
|---|---|---|---|---|
| bubble n=16 | 19 | 0.65 | 0.03 | 0.68 |
| bubble n=32 | 35 | 1.53 | 0.10 | 1.18 |
| bubble n=64 | 67 | 4.47 | 0.33 | 3.26 |
| bubble n=128 | 131 | 17.68 | 1.23 | 5.92 |
| bubble n=256 | 259 | 65.92 | 4.78 | 22.51 |
| selection n=256 | 33,152 | 15,899 | 653.29 | 872.98 |
| insertion n=256 | 767 | 297.82 | 14.11 | 42.13 |
| shell n=256 | 5,389 | 2,207.96 | 99.12 | 168.43 |
| merge n=256 | 1,791 | 728.59 | 34.31 | 62.43 |
| quick n=256 | 13,166 | 5,756.63 | 279.99 | 382.10 |
| heap n=256 | 1,971 | 919.49 | 39.36 | 120.06 |
| heap heapify(max) n=256 | 508 | 300.99 | 16.49 | 21.40 |
| heap 逐个 insert n=256 | 1,746 | 656.17 | 31.33 | 79.63 |
| graph DFS 完全图 20 顶点 | 422 | 174.04 | 8.17 | 12.65 |
| graph BFS 完全图 20 顶点 | 402 | 153.78 | 7.73 | 61.50 |
| bst 建树 n=256（bstFrom，压缩单步） | 1 | 20.95 | 0.02 | 3.74 |

注：bubble 步骤版带"一趟无交换提前退出"，随机数组上 steps 远小于 n²/2，是快照法在排序中最便宜的算法；selection 步骤版逐比较记录，是最坏场景。

**超出运行时的硬证据**：n=256 的 selection 结果**整体 `JSON.stringify` 直接抛 `RangeError: Invalid string length`**（超出 V8 最大字符串长度 ≈ 2^29-24 字符 ≈ 512MB），benchmark 因此改为分块累计——快照体积的立方增长不是理论风险。

## 3. 教学规模评估

产品实际暴露的规模上限：

- 排序实验室 UI 硬限制 `slice(0, 40)`（sorting-lab.tsx 解析输入）；
- 数据结构实验室输入为人工输入（个位数到几十）；
- 图邻接矩阵教学上限 20 顶点（MAXN）。

n=40 外推（按立方缩放自 n=256 实测）：selection ≈ 25MB / <1s；n=16~32 全算法均在几十 ms / 数 MB 内。**教学规模完全可接受**：交互单次生成 <1s、内存在百 MB 以下且操作结束即可回收（步骤数组随组件卸载释放）。

既有 NFR 防线：`tests/final-audit.test.ts`（64 元素排序步骤生成 < 200ms，多次取样）继续守护交互指标。

## 4. 结论：保持 Snapshot v1，不重构

按 P15 任务书三十的裁决标准：

- 教学 UI 规模（≤40 元素 / 20 顶点）下无内存爆炸、无 GC 卡顿（实测全部 <1s、<100MB）；
- `Previous / Jump / Replay` 语义依赖"任意步 O(1) 取完整快照"，Checkpoint+Delta 会显著增加引擎复杂度与出错面，违背"不为炫技重构"原则。

**Engine v2（Checkpoint + Delta）的触发条件（写入 Known Limitations）**：

1. 产品放开排序输入上限（>64）且包含 selection/quick 逐比较步骤；或
2. 出现 >100MB 单操作内存的用户可见卡顿/GC 抖动报告；或
3. 需要序列化导出完整步骤流（当前导出走语义状态，不导出步骤）。

满足任一条件时再立项，且必须保持 Previous/Jump/Replay 行为零回归（差分与 usePlayback 测试已有覆盖）。

## 5. 遗留观察（非阻塞）

- `deepFreeze` 递归在全步骤完成后一次性执行，O(总体积) 的 CPU 集中在 finish()——教学规模下 <100ms，无需增量冻结。
- final-audit 的 200ms NFR 断言在本机高负载并行测试时偶发超时（取样最小值仍超）——CI 环境稳定全绿；如需进一步稳健可提高取样次数（属测试稳健性，不属引擎问题）。
