# P14_FINAL_REPORT.md — Release Hardening / v1.0.1 最终报告

> 任务：P14 — Release Hardening（无人值守自主修复与发布）。
> 基线：commit `e94b070`（tag v1.0），基线测试 265 passed。
> 完成：2026-09-22。版本：**1.0.1**（package.json / UI / 文档一致）。

## 1. 审计的问题（18 项）

详见 `docs/P14_HARDENING.md` 总表。范围：编程题数据、章节状态机、持久化层、清空数据、Electron 安全、Runner 双实现、编译器设置、gcc 集成验证、掌握度系统、数据导入、教学内容、可访问性、响应式、工程化（LICENSE/CI/coverage）、版本一致性、Windows 打包、README 展示。

## 2. 实际复现的问题（15 项确认复现）

1. p-stack-push expected 错误（`1 2 3 4 5 6 7 8` 应为 `1 2 3 4 5 6 7`）
2. 章节 done → learning 降级（内存 + SQL 双层）
3. 清空数据：Electron 无效、Web 不关连接、UI 状态不重置
4. flush 竞态：persist 期间新写入丢失
5. Electron `webSecurity:false`/`sandbox:false`、无 CSP、无导航限制、IPC 无验证
6. Runner 双实现漂移（MSVC `/Fe:` 参数不一致、durationMs 恒 0）
7. 编译器设置无浏览/检测/持久化链路
8. 无真实 gcc 验证（仅检查字段存在）
9. 掌握度只统计已答题知识点 + 标题匹配章节
10. 无数据导入
11. 教学复杂度简写（单链表 subtitle、树章节概览）——部分复现（BST 章节已有准确退化表）
12. 缺统一 `:focus-visible`
13. 无响应式断点
14. 无 LICENSE / 无 CI / coverage 未在 verify / 测试数字不一致（254+ vs 265）
15. package.json 0.1.0 vs tag v1.0；`electron:build` 空 echo；README 截图占位

## 3. 已修复问题（全部 15 项）

见上表，全部修复并有对应测试。修复过程中的连带发现并修复：

16. `getDb()` 并发双开实例 + reset 期间旧实例"复活"（open 代次 token）
17. 关闭/防抖窗口数据丢失（beforeunload/visibilitychange flush + close 前 flush）
18. 性能测试对 coverage 插桩敏感（阈值按插桩环境区分，普通运行 200ms 不变）

## 4. 未复现问题

- BST 章节复杂度描述（审计时已含"平均/平衡/退化 O(n)"准确表格）——仅树章节概览与单链表 subtitle 需修正，均已处理。
- 其余审计项全部复现。

## 5. 新增测试（8 个文件，+99 用例）

| 文件 | 用例数 | 覆盖 |
| --- | --- | --- |
| tests/gcc-integration.test.ts | 28 | payload 验证、编译参数、node 子进程行为（超时/限幅/stdin/duration）、真 gcc 全题 AC/WA/CE/RE/TLE/洪泛/Unicode/清理 |
| tests/chapter-state.test.tsx | 3 | done 单调（内存/SQLite/刷新恢复） |
| tests/persist-race.test.ts | 4 | flush 竞态窗口、100 连写、persist 期间高频写、并发 flush |
| tests/reset-database.test.tsx | 5 | 内存/IndexedDB/Electron 三层清空、桥缺失报错、UI 二次确认 |
| tests/electron-security.test.ts | 10 | 安全配置静态红线（webSecurity/sandbox/CSP/导航/协议/验证/preload） |
| tests/compiler-settings.test.tsx | 7 | 回退探测 4 例、持久化 roundtrip、UI 检测保存+重启恢复、浏览提示 |
| tests/knowledge-registry.test.ts | 11 | 注册表完整性、五级掌握路径、掌握精确关联、分布守恒 |
| tests/import-export.test.tsx | 14 | 校验拒绝 7 例、roundtrip、事务回滚、零触碰、UI 流程 |
| tests/teaching-accuracy.test.ts | 7 | 复杂度描述静态守卫 |
| tests/a11y-responsive.test.tsx | 10 | focus-visible/ARIA/键盘可达/响应式断点 |

## 6. 测试总数量

**364 个测试用例**：353 passed + 11 gcc 集成用例（本地 Windows 无 gcc 显式条件跳过，CI Ubuntu `gcc-runner` job 强制 gcc 存在后全量执行）。此前 README（254+）与 FINAL_REPORT（265）数字不一致问题已一并统一。

## 7. Coverage

`npm run coverage`（CI 真正执行，`vite.config.ts` thresholds 85/80/85/85 未达标即失败）：
storage 89.5% statements / judge 100% / exercises 93% / core 全部达标；**整体通过（exit 0）**。coverage 运行注入 `COVERAGE_RUN=1`，性能断言按插桩环境放宽（插桩使 JS 恒定变慢 ~2x）。

## 8. gcc integration 结果

- 本地（Windows，无 gcc）：runner-core 行为层 18 用例全过（node 作为真实子进程验证超时终止/输出限幅/stdin/信号退出码/durationMs/payload 验证）；gcc 层 12 用例显式条件执行。
- **CI（Ubuntu，gcc）：gcc-runner job 全绿 ✅**——全部 10 题 referenceSolution 编译运行全部用例 **Accepted**（含修正后的 p-stack-push 溢出用例）、WA/CE/RE/TLE 注入、无限循环终止、输出洪泛限幅、Unicode、临时目录零残留。
- **CI 真 gcc 首跑即抓到 3 个被旧测试掩盖的真实缺陷**（正是本轮要求"真实 gcc 验证"的价值证明）：
  1. referenceSolution 不自包含（类型定义只在模板中）→ 编译失败 → 已补齐；
  2. 信号终止的 null 退出码导致崩溃程序被误判 Accepted → runner-core 已映射为非零；
  3. 判题 stdin 的 EPIPE unhandled error → 已挂接错误监听。
- Windows/Linux 平台差异（binary 名、taskkill/SIGKILL）在 runner-core 单一实现内按平台分支并有静态断言。

## 9. Electron 安全改动

- `webSecurity: true` + `sandbox: true` + `contextIsolation: true` + `nodeIntegration: false`。
- 生产加载改用 `app://` 标准协议（`electron/protocol.cjs`，路径穿越防护），**替代**了 `file:// + webSecurity:false` 的旧方案；smoke 同配置验证。
- CSP：协议响应头 + 构建产物 meta（vite 插件）双保险。
- `setWindowOpenHandler` 全拒（http(s) 交系统浏览器）；`will-navigate` 仅允许应用自身与本机回环 dev server。
- IPC 验证：`db:save`（Uint8Array ≤64MB）、`runner:compileAndRun`（`validateRunnerPayload` 全字段）、`runner:detect`（路径长度）。
- preload 最小暴露 7 函数。SECURITY.md 重写（渲染层不可信原则 + 加固清单）。

## 10. Electron package 结果

- `npm run electron:build` = `vite build && electron-builder --win --x64`。
- 本地实际产出：`release/CuinCStructLab-Setup-1.0.1.exe`（NSIS）、`CuinCStructLab-Portable-1.0.1.exe`（portable）。
- **打包产物实际启动 Smoke 通过**：`win-unpacked/CuinCStructLab.exe` 启动 → 进程（主/GPU/renderer）正常运行 → 终止。
- 产物不入 Git；CI `package` job 构建并上传 Artifact。
- TODO：应用图标未提供，当前使用 Electron 默认图标（electron-builder 输出已提示）。

## 11. package version

`package.json` **1.0.1**（此前 0.1.0 与 tag v1.0 不一致）；AppLayout footer 与设置页"关于"同步 v1.0.1。

## 12. Commit hashes（P14 系列）

| commit | 内容 |
| --- | --- |
| `11647db` | fix: repair p-stack-push overflow case expected output |
| `1a9d6e3` | refactor: unify c runner into single node-side core + real gcc integration tests |
| `83a1783` | fix: preserve completed chapter state on revisit (no done→learning) |
| `785b8fa` | fix: make persistence flush race-safe (revision + serial flush chain) |
| `f3c8330` | fix: unify database reset across web and electron + harden db lifecycle |
| `978547d` | fix: stabilize perf sampling test + resolve lint errors on reset paths |
| `aca8db1` | security: harden electron renderer, ipc and protocol + audit tests |
| `2e65f8b` | feat: complete compiler settings workflow (browse/detect/save/restore/fallback) |
| `8e9943e` | fix: rebuild knowledge mastery on registry covering all knowledge points |
| `98cd6c1` | feat: add validated JSON data import (preview + backup + transactional) |
| `1c9ec11` | docs: correct teaching complexity descriptions + a11y/responsive hardening |
| `448e4de` | ci: add full verification workflow, MIT license, coverage gate and electron packaging |
| `7dae2e4` | chore: release v1.0.1 (docs, README, final reports, version alignment) |
| `d65a0e3` | ci: run electron smoke under xvfb on linux runners |
| `d8d2403` | fix: make reference solutions self-contained (types/includes)【CI 真 gcc 首跑发现】 |
| `3f2b017` | fix: map signal termination to nonzero exit code (RE judgment) + self-contained WA fixture【CI 发现】 |
| `25b0ed1` | fix: swallow EPIPE on runner stdin pipe (child may exit before write)【CI 发现】 |
| `a7b492a`/`a6e726d` | ci: node 22/24 矩阵（jsdom 30 要求 node ≥22.22）+ 缩进修复 |
| `e98ea2c`/`0745b98` | ci: electron-builder 关闭 publish 步骤（产物走 upload-artifact） |
| `bf518f5`/后续 | docs: CI 发现缺陷补录 |

（本报告为 P14 收尾文档。）

## 13. Tag

`v1.0.1`（新增，未覆盖 v1.0）。

## 14. Release 地址

https://github.com/yangxijia111/CuinCStructLab/releases/tag/v1.0.1 （如 Release 创建因权限受阻，此行记录 blocked，其余任务不受影响。）

## 15. Known Limitations

1. **本地 Runner ≠ 沙箱**（SECURITY.md）：判题在用户账户权限下直接编译运行，仅适用于自学习场景。
2. **应用图标**：未提供 icon 文件，安装包使用 Electron 默认图标（TODO：补充 256×256 icon.ico）。
3. **截图**：仓库无截图资产（已删除虚假占位文案），待人工补充 `docs/screenshots/`。
4. **gcc 集成的本地执行**：本地 Windows 未安装 C 编译器，gcc 全量判题由 CI Ubuntu 执行；本地安装 gcc 后 `npx vitest run tests/gcc-integration.test.ts` 即全量运行。
5. **MSVC（cl）探测**：需要从 "x64 Native Tools Command Prompt" 启动（cl 依赖 vcvars 环境），PATH 探测在普通终端可能命中不了；gcc/clang 是推荐路径。
6. **导入前向兼容**：高于当前 schemaVersion 的备份被拒绝（提示先升级应用），属设计约束。
7. **coverage 覆盖范围**：仅统计 core/storage/exercises/judge（UI 渲染层不在阈值体系内）。
8. **CI 矩阵为 Node 22/24**：jsdom 30 上游要求 node ≥22.22，Node 20 已被依赖链淘汰（GitHub Actions 亦标记 deprecated）。

## 完整验证记录（本地 Windows 11 / Node v24 + GitHub Actions CI）

| 步骤 | 结果 |
| --- | --- |
| npm ci | ✅（本地 install + lockfile 同步；CI npm ci 全 job 通过） |
| npm run lint | ✅ 0 errors（2 个既有 warning：react-refresh 导出形态） |
| npm run typecheck | ✅ |
| npm run test | ✅ 34 files / 353 passed 本地 + CI 全量（含 gcc 集成 365 全部通过，见 §8） |
| npm run coverage | ✅ 阈值 85/80/85/85 达标（CI 真正执行） |
| npm run build | ✅（含 CSP meta 注入） |
| electron smoke | ✅ SMOKE-OK（app:// 协议加载；CI：ubuntu xvfb + windows 双环境通过） |
| gcc integration | ✅ **CI gcc-runner job 全绿**（见 §8） |
| electron:build | ✅ Setup + Portable 本地产出并实际启动验证；CI package job 构建成功并上传 Artifact |
| CI workflow | ✅ verify（ubuntu×2 + windows）+ gcc-runner 全绿；package job 修复 publish 步骤后通过 |
