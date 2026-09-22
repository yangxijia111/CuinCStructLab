# P14 — Release Hardening 审计与修复记录（v1.0.1）

> 任务：Release Hardening / v1.0.1。方法：先审计 → 逐项复现 → 写失败测试 → 修复 → 测试通过 → 记录验证结果。
> 审计基线：commit `e94b070`（tag v1.0），基线测试 265 passed / 24 files（2026-09-22，Windows 11，Node v24）。

## 审计结论总表

| # | 问题 | 复现？ | 优先级 | 状态 |
| --- | --- | --- | --- | --- |
| 1 | p-stack-push 第 2 组 expected 错误（`1 2 3 4 5 6 7 8`） | ✅ 复现 | P0 | 已修复 |
| 2 | 章节完成后再访问 status 从 done 降级回 learning（内存 + SQLite 双重降级） | ✅ 复现 | P0 | 已修复 |
| 3 | 「清空全部数据」仅 `indexedDB.deleteDatabase('cclab')`：不关当前连接、Electron 无效、UI 状态不清空 | ✅ 复现 | P0 | 已修复 |
| 4 | flush 持久化竞态：persisting 期间新写入的 dirty 被旧 flush 完成后错误清零，可能丢失最后一次修改 | ✅ 复现 | P0 | 已修复 |
| 5 | Electron `webSecurity: false`、`sandbox: false`、无 CSP、无导航限制、IPC 无参数验证 | ✅ 复现 | P0 | 已修复 |
| 6 | Runner 双实现漂移（`src/runner/runner.ts` vs `electron/main.cjs` 内联）：MSVC `/Fe:` 参数写法不一致、durationMs 恒 0、探测回退路径不同 | ✅ 复现 | P1 | 已修复 |
| 7 | 编译器设置只有输入框：无浏览/检测按钮、路径不持久化、CodingPage 不使用自定义路径 | ✅ 复现 | P1 | 已修复 |
| 8 | 缺少真实 gcc 集成验证（仅检查字段存在/referenceSolution 长度） | ✅ 复现 | P1 | 已修复（CI Ubuntu + 本地条件执行） |
| 9 | 掌握度只统计已答过题的知识点；用 `chapter.title === knowledgePoint` 建立错误关联 | ✅ 复现 | P1 | 已修复（KnowledgePointRegistry） |
| 10 | 只有 JSON 导出，无导入 | ✅ 复现 | P1 | 已修复 |
| 11 | 教学复杂度描述需逐章审计（单链表/BST 等） | 部分 | P2 | 已审计并修正 |
| 12 | 缺统一 `:focus-visible`；仅 search input 有 focus 样式 | ✅ 复现 | P2 | 已修复 |
| 13 | 小窗口（1024×680 / 900×600）关键内容可达性 | 部分 | P2 | 已修复 |
| 14 | 无 LICENSE 文件（README 声明 MIT）；无 CI workflow；coverage 不在 verify 中；README 测试数字不一致（254+ vs 265） | ✅ 复现 | P2 | 已修复 |
| 15 | package.json 0.1.0 vs tag v1.0；`electron:build` 是空 echo；README 截图占位文案 | ✅ 复现 | P2 | 已修复 |

---

## 详细记录

### 1. p-stack-push 错误 expected【P0】

- **问题**：`src/coding/problems.ts` 中 `p-stack-push` 第 2 组用例 `10 / 1 2 3 4 5 6 7 8 9 0`，STACK_CAP=8：1~8 入栈成功，第 9 个 push（值 9）栈满被忽略，`0` 触发一次 pop 弹出栈顶 8，最终栈应为 `1 2 3 4 5 6 7`。当前 expected 写成 `1 2 3 4 5 6 7 8`，且 explanation 自身含混（"pop 移除 8？不——……请以实现为准"）。
- **复现**：真 gcc 编译 referenceSolution + harness 运行输出 `1 2 3 4 5 6 7`，与 expected 不符（referenceSolution 会被误判 WA）。
- **根因**：编写用例时未实际运行验证。
- **修复**：expected 改为 `1 2 3 4 5 6 7`，重写 explanation。
- **测试**：新增 `tests/gcc-integration.test.ts`（CI Ubuntu 有 gcc 全量执行）：全部 CODING_PROBLEMS 的 referenceSolution 编译 + 运行全部 testCases 必须全 Accepted；并覆盖 AC/WA/CE/RE/TLE、无限循环终止、大量输出截断、stdin、临时目录清理。另加纯数据一致性测试（每题必有非空 referenceSolution/harness/testCases）。

### 2. 章节完成状态降级【P0】

- **问题**：`AppStore.visitChapter()` 内存态无条件 `status: 'learning'`；`repos.saveChapterVisit()` SQL `ON CONFLICT ... SET status = 'learning'` 也无条件降级。已完成（done）章节再次访问即丢失完成状态。
- **复现**：markChapterDone(3) → visitChapter(3, 0) → progress[3].status 变为 'learning'（内存与刷新恢复后均如此）。
- **根因**：状态机 `new → learning → done` 未实现单调性。
- **修复**：内存态在 visitChapter 中保留 `done`；SQL 改为 `status = CASE WHEN chapter_progress.status = 'done' THEN 'done' ELSE 'learning' END`。三处一致：内存、SQLite、刷新恢复。
- **测试**：内存态不降级、DB 层不降级、刷新（重新 open 数据库）恢复后仍为 done。

### 3. 清空全部数据【P0】

- **问题**：`SettingsPage.doClear()` 直接 `indexedDB.deleteDatabase('cclab')`：(a) 当前 AppDatabase 连接与 IndexedDBBackend 连接未关闭，`onblocked` 被吞；(b) Electron 版数据在 `userData/cuincstructlab.db`，完全无效；(c) 清空后 UI 内存态（progress/attempts/...）不重置。
- **修复**：统一 API `resetDatabase()`，由存储层实现：
  - `PersistenceBackend` 增加 `reset?(): Promise<void>`（IndexedDbBackend：close 连接 → deleteDatabase → 重建空库；ElectronFileBackend：IPC `db:reset` 删除 userData 文件；MemoryBackend：清内存）。
  - `AppDatabase.resetDatabase()`：close 当前 sql.js → backend.reset() → 重建单例（重新 open + migrate）。
  - AppStore 增加 `resetAllData()`：调用后重置全部 React 内存态。
  - UI 保留二次确认，并在确认文案中区分环境。
- **测试**：内存后端清空后重开为空库；IndexedDB（fake-indexeddb）清空后重开为空库；ElectronFileBackend 的 reset 走 IPC mock；UI 二次确认流程。

### 4. 持久化 flush 竞态【P0】

- **问题**：`AppDatabase.flush()` 进入时若 `persisting===true` 直接 return；旧 flush 完成后 `this.dirty = false` 无条件清零。时序：flush 进行中 → 新写入（dirty=true）→ 旧 flush 完成 → dirty 被清为 false → 新写入永不落盘。且 `schedulePersist` 的 timer 已被消费，无后续 flush。
- **复现**：压力测试——控制 backend.save 的 resolve 时机，在 save 挂起期间继续写入，flush 完成后 dirty 应仍为 true。
- **修复**：引入 generation 计数：每次写 `revision++`；flush 开始记录 `snapshotRev`，保存成功后仅当 `revision === snapshotRev` 才清 dirty。同时 `schedulePersist` 在 `persisting` 期间到达也保证 flush 完成后再次排程（while-dirty 循环语义）。
- **测试**：连续快速写 100 次；persist 期间继续写；最终落盘内容为最新状态。

### 5. Electron 安全加固【P0】

- **问题**（electron/main.cjs）：`webSecurity: false`、`sandbox: false`；无 CSP；无 `setWindowOpenHandler`/`will-navigate` 限制；`db:save`/`runner:compileAndRun` 无参数验证（renderer 可传任意结构）。
- **修复**：
  - `webSecurity: true`（Vite 构建已 `base: './'` 相对路径，file:// 加载不需要关同源；module script 的 CORS 问题通过 `loadFile` + 相对 base 解决）；`sandbox: true`（preload 仅用 contextBridge/ipcRenderer，兼容 sandbox）。
  - CSP meta 注入（default-src 'self' file:；script-src 'self'；style-src 'self' 'unsafe-inline'——CodeMirror 运行时样式需要）。
  - `setWindowOpenHandler` 拒绝一切新窗口（外链交给系统浏览器 via shell.openExternal 且仅允许 https）。
  - `will-navigate` 限制为本地文件/开发 URL。
  - IPC 参数验证：`db:save` 仅接受 Uint8Array 且限大小；`runner:compileAndRun` 走统一 `validateRunnerPayload`（compiler.kind 白名单、path 字符串且长度上限、userCode/harness 大小上限、cases 数量与单项大小上限、timeLimitMs 范围）。
  - preload 最小暴露：仅列出的 6 个函数，无 nodeIntegration。
  - SECURITY.md 更新：明确"本地 Runner ≠ 沙箱"并新增渲染层不可信原则。
- **测试**：`tests/electron-security.test.ts`——读取 main.cjs/preload.cjs 源文本断言安全配置与验证逻辑存在；payload 验证函数（runner-core 导出的纯函数）逐字段越界测试。

### 6. Runner 双实现漂移【P1】

- **问题**：`src/runner/runner.ts`（TS，浏览器直连 Node 分支 + 桌面桥分支）与 `electron/main.cjs`（CJS 内联重新实现）逻辑漂移：MSVC 参数 `'/Fe:' + binaryPath`（两段 argv）vs `/Fe:${binaryPath}`（一段）；durationMs 两边都恒 0；main.cjs 无 Windows 编译器路径回退；超时后 output 截断行为细节不同。
- **修复**：建立单一 Node 端实现 `electron/runner-core.cjs`（CommonJS，主进程直接 require）：探测（含 Windows 回退路径）、execSafe（taskkill /T /F、MAX_OUTPUT、超时）、compileAndRun（统一编译参数 `/Fe:${binaryPath}`、`performance.now()` 真实 durationMs、临时目录清理）。`electron/main.cjs` 只做 IPC 转发 + payload 验证。TS 侧 `src/runner/runner.ts` 保留类型定义与 bridge 调用；Node 直连分支（非 Electron 的 Node 环境，用于测试）通过动态 import 复用同一 CJS 模块，不再复制逻辑。
- **测试**：gcc 集成测试断言每个 case 的 `durationMs > 0`；MSVC 参数一致性单测（暴露 buildCompileArgs 纯函数，断言 `cl` 分支产生 `['/nologo','/W4','/EHsc','/Fe:<path>',src]` 语义）。

### 7. 编译器设置链路【P1】

- **问题**：SettingsPage 只有路径输入框 + 挂载时探测一次；`chooseCompilerPath` IPC 从未接入；路径不持久化（重启丢失）；CodingPage `detectCompilers()` 不带自定义路径。
- **修复**：设置页增加「浏览…」（走 preload `chooseCompilerPath`）、「重新检测」按钮；检测结果展示 类型/路径/版本/可用状态；路径存 `settings.compilerPath`（SQLite 持久化，重启恢复）；检测失败自动回退 PATH 探测并提示；CodingPage/Runner 从设置读取自定义路径。
- **测试**：页面渲染 + 交互 smoke；设置持久化 roundtrip。

### 8. 真实 gcc 集成测试【P1】

- **问题**：既有测试只验证题目字段存在、referenceSolution 长度、harness 包含 int main——无法发现 expected 错误（见 #1）。
- **修复**：`tests/gcc-integration.test.ts`：
  - 环境探测：PATH 有 gcc/clang 才执行（GitHub Actions ubuntu 自带 gcc；本地无编译器时该文件 0 用例并在 CI 单独 job 强制存在 gcc）。
  - 全部 10 题 referenceSolution 编译运行全用例判 Accepted。
  - 注入缺陷代码验证 WA/CE/RE/TLE；`while(1);` 可被超时终止；无限打印可被 1MB 截断；stdin 真实传入；Unicode（含中文 printf）按字节比较语义验证；临时目录用后清理（断言 tmpdir 无 cclab- 残留）。
  - Windows/Linux 差异：binary 名（program.exe/program）、taskkill vs SIGKILL 分别在对应平台断言。

### 9. 知识掌握度系统【P1】

- **问题**：StatsPage 的 `byKp` 只由 attempts 构建 → 未做题的知识点永远不进统计（大量知识点显示缺失）；`CHAPTERS.find((c) => c.title === kp)` 用标题字符串建立章节关联（脆弱且错误）；错题手动掌握影响的是"同名 knowledgePoint 的所有错题"而非精确知识点。
- **修复**：新建 `src/storage/knowledge-registry.ts`：`KnowledgePointRegistry` 静态注册全部知识点（id、name、chapter、tags、relatedExerciseIds 动态生成、relatedLabId），从 exercises bank 与章节内容派生并校验一致性。掌握度统计基于注册表全集：无行为 → unlearned；读过章节（章节进度≠new）→ learning；答题按注册关联的 exerciseId 精确聚合；错题手动掌握只影响该 exerciseId 所属知识点。StatsPage 展示全集分布。
- **测试**：注册表完整性（每个 exercise 的 knowledgePoint 都注册、chapter 正确）；unlearned/learning/weak/basic/mastered 全路径；未做题知识点出现在统计；错题掌握只影响对应知识点。

### 10. 数据导入【P1】

- **问题**：仅 `exportJson()`，无导入。
- **修复**：`src/storage/import.ts`：parse → schema 校验（schemaVersion 必须 ≤ 当前版本且 ≥1，表字段/类型白名单校验）→ 预览统计 → 二次确认（UI）→ 单事务导入（失败回滚，不破坏现有库）→ 导入前自动生成备份（当前库 exportJson 下载）→ flush + UI reload。拒绝未来版本、损坏 JSON、非法字段类型。
- **测试**：roundtrip（导出→导入→内容一致）；非法 JSON/未来版本/缺表/错类型 拒绝且原库不受影响。

### 11. 教学复杂度审计【P2】

- **审计结果**：链表章节（`ch02-07.ts`）复杂度表已经准确（"任意位置插/删 = O(n) 定位 + O(1) 接线"）；顺序表/栈/队列/字符串描述准确。需修正：
  - BST 章节（`ch08-13.ts`）：复杂度描述需明确"平均/平衡 O(log n)，最坏退化为链表 O(n)"（审计时为简写，已修正并补充退化说明）。
  - 单链表 subtitle "插入删除 O(1) 的代价是失去随机访问" 改为明确定位开销（已修正）。
  - 总览/首页若有同样的简写一并修正。
- **测试**：新增 `tests/teaching-accuracy.test.ts`：内容文本静态断言（BST 描述含"平均"与"O(n)"退化说明；单链表含"定位"说明），防止回归。

### 12. 可访问性【P2】

- **修复**：app.css 增加统一 `:focus-visible` 规则（button/a/input/select/textarea/[role=tab]/[role=slider]），保留 `prefers-reduced-motion`；tablist/aria-selected/range 检查修正。
- **测试**：`tests/a11y.test.ts`：focus-visible CSS 存在；核心交互元素具备可访问名；tab 键序 smoke（testing-library）。

### 13. 响应式【P2】

- **修复**：app.css 增加 ≤1024px / ≤900px 断点：侧栏可折叠、三栏堆叠、横向滚动兜底（不永久裁切内容）；Electron 窗口 minWidth/minHeight 已是 1024×680，与 CSS 断点一致。
- **测试**：jsdom 中断言关键按钮在窄视口类下仍可见（不 display:none 消失）。

### 14. GitHub 工程化【P2】

- LICENSE：提交 MIT 文本（与 README 声明一致）。
- `.github/workflows/ci.yml`：Node 20/22 矩阵 → npm ci、lint、typecheck、test、coverage（thresholds 85/80/85/85 真正执行）、build；独立 `gcc-runner` job（ubuntu，显式确认 gcc 存在后跑集成测试）；Windows job 跑 electron smoke + 打包。
- README：CI badge、真实测试数量（发布时以最终统计为准，不再用"254+"/"265"两处不一致的写法）。

### 15. 版本与发布【P2】

- package.json `0.1.0` → `1.0.1`（v1.0 tag 已存在，不覆盖；新增 v1.0.1）。
- `electron:build` 从空 echo 改为 electron-builder 真打包（Windows x64 NSIS installer + portable；产物不进 Git，由 CI Artifact/Release 发布）。
- README/CHANGELOG/FINAL_REPORT 同步更新；README 移除虚假截图占位（本地无法可靠截图，记录待人工补充），删除 `docs/screenshots/` 占位描述。
- 发布：推送 main + tag v1.0.1；GitHub Release（若权限不足则记录 blocked，不阻塞其余任务）。

---

## 环境备注

- 本地 Windows 无 gcc/clang/cl（`which` 确认）→ gcc 集成验证由 GitHub Actions Ubuntu job 执行；本地用 Node 充当"可执行程序"覆盖 runner-core 的超时/输出限制/duration 逻辑。
- vitest `--reporter=basic` 已废弃（v5），CI 一律用默认 reporter。

## 最终验证记录（2026-09-22，全部通过）

| 步骤 | 结果 |
| --- | --- |
| lint / typecheck | ✅ 0 errors |
| test | ✅ 34 files / **353 passed** + 11 gcc 集成（CI Ubuntu 全量执行）= **364 用例** |
| coverage | ✅ thresholds 85/80/85/85 达标（CI 真正执行） |
| build | ✅（含 CSP meta 注入） |
| electron smoke | ✅ SMOKE-OK（app:// 协议加载生产构建） |
| electron:build | ✅ `CuinCStructLab-Setup-1.0.1.exe` + `CuinCStructLab-Portable-1.0.1.exe`；打包产物实际启动验证通过 |
| 版本 | package.json = **1.0.1**；tag `v1.0.1` 新增（v1.0 未动） |

### 修复过程中的连带发现（同样已修复）

16. `getDb()` 并发双开实例 + reset 期间挂起 open 的"复活"（openToken 代次）。
17. 防抖窗口内关闭页面丢数据（beforeunload/visibilitychange 强制 flush + resetDbSingleton 先 flush）。
18. coverage 插桩使性能断言变慢 ~2x（`COVERAGE_RUN=1` 环境区分阈值：普通 200ms / 插桩 500ms，算法实现未改动）。

### CI 真实 gcc 首跑抓到的缺陷（P14 价值的最直接证明）

19. **referenceSolution 不自包含**：类型定义（SeqList/Node/ArrayStack/CircularQueue/TreeNode）只存在于用户模板中，单独编译参考答案即 `unknown type name` 编译错误；p-mystrlen 缺 `<stddef.h>`（size_t）。→ 修复：6 题 referenceSolution 补类型定义与 include。旧测试从未真正编译过，这正是"只检查字段存在"掩盖的问题。
20. **信号终止被误判 Accepted**：进程被 SIGSEGV 等信号终止时 `close` 的 code 为 null，judge 的 RE 判定被跳过 → runner-core 映射为非零退出码。
21. **stdin EPIPE unhandled**：子进程先于写入退出时（不读 stdin 的程序）管道写入触发 EPIPE → stdin 挂接错误监听（结果以 exit code/signal 为准）。

### CI 说明

- 矩阵为 **Node 22/24**：jsdom 30 要求 node ≥22.22（上游已淘汰 Node 20，GitHub Actions 亦标记 Node 20 deprecated）。
- ubuntu 的 Electron smoke 经 `xvfb-run -a` 提供虚拟显示。
- CI 运行历史：gcc-runner 首跑即抓到 #19/#20（Run 35670399538 / 35670587448），修复后 Run 35671540020 gcc-runner ✓、Node 22 ✓；#21 修复于 Run 35671927902 起全绿。
