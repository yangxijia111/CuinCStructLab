# SECURITY.md — 安全说明

## 本地编译运行 ≠ 安全沙箱

CuinCStructLab 的"本地 C Runner"在你的机器上**编译并运行你写的 C 代码**。
这带来便利，也带来必须知晓的限制：

- **这不是真正的沙箱。** 用户代码与运行器运行在同一操作系统账户下，理论上可以执行该账户权限内的任意操作（读写文件、访问网络等）。
- 本平台面向**本人学习场景**（自己写代码、自己判题）。不要用它运行来路不明的代码。
- 若需要运行不可信代码，请使用真正的隔离手段（容器、虚拟机、专用账户），那超出了本平台的设计目标。

## 已实施的防护（降低风险，不等于沙箱）

### C Runner（本地判题）

| 措施 | 说明 |
| --- | --- |
| 禁止 shell 拼接 | 编译与运行一律 `spawn(cmd, args[])` 数组参数；用户输入只进入文件内容与 stdin，绝不进入命令行 → 杜绝命令注入 |
| 文件名白名单 | 临时目录内只使用固定的 `main.c` / `program(.exe)` 文件名 |
| 独立临时目录 | 每次判题使用 `os.tmpdir()/cclab-<uuid>/`，结束（无论成败）递归删除 |
| 超时控制 | 编译 15 秒；单用例默认 5 秒（合法范围 100ms–30s），超时后 Windows 用 `taskkill /PID <pid> /T /F` 终止整个进程树，其他平台 SIGKILL |
| 输出限制 | stdout/stderr 各限 1MB，超出截断（防止输出洪泛拖垮进程） |
| 编译器白名单 | 仅探测 gcc / clang / MSVC cl；支持用户指定路径 |
| 单一实现 | 全部 Runner 逻辑唯一存在于 `electron/runner-core.cjs`；IPC 层只做验证与转发，杜绝多副本漂移 |

### Electron 桌面外壳（v1.0.1 加固）

| 措施 | 说明 |
| --- | --- |
| 渲染隔离 | `contextIsolation: true`、`nodeIntegration: false`、`sandbox: true`、`webSecurity: true`（从不关闭同源限制） |
| 标准协议加载 | 生产构建经 `app://` 自定义标准协议加载（Electron 官方推荐），ES modules 与相对路径在 `webSecurity: true` 下正常工作，无需降级安全配置 |
| CSP | 响应头注入 `Content-Security-Policy`（`script-src 'self'`、`object-src 'none'`、`base-uri 'none'` 等），限制脚本与连接来源 |
| 导航限制 | `will-navigate` 仅允许应用自身地址与本机回环开发服务器；其余拦截 |
| 新窗口限制 | `setWindowOpenHandler` 一律拒绝新窗口；http(s) 链接交系统浏览器打开 |
| 最小 preload | preload 仅通过 `contextBridge` 暴露 7 个白名单函数（数据库读写/重置、Runner 探测/判题、编译器选择），无其他能力 |
| 路径穿越防护 | `app://` 协议处理器规范化路径并限制在 `dist/` 内 |
| **渲染层不可信** | 所有 IPC 参数在主进程二次验证：`db:save` 仅接受 `Uint8Array` 且 ≤64MB；`runner:compileAndRun` 必须通过 `validateRunnerPayload`（compiler.kind 白名单、路径/代码/harness 长度上限、cases ≤100 组、单项 stdin/expected ≤256KB、timeLimitMs ∈ [100, 30000] 且为整数），验证失败直接拒绝 |

以上安全配置由 `tests/electron-security.test.ts` 静态断言守护，`validateRunnerPayload` 行为在 `tests/gcc-integration.test.ts` 逐字段越界验证。

## 数据安全

- 全部学习数据保存在本地（浏览器 IndexedDB / 桌面版 `userData/cuincstructlab.db`），不上传任何服务器。
- 平台无账号体系、无网络上报。
- 数据导出/导入（JSON）由用户主动操作；导入前做 schema/版本校验，拒绝非法或未来版本数据，且导入失败不破坏现有数据库。
- 「清空全部数据」统一走 `resetDatabase()`：先关闭数据库连接，再删除底层介质（IndexedDB 库 / userData 文件），并有二次确认。

## 模拟地址声明

课程与动画中的内存地址（如 0x1000、0x8000）均为**教学模拟地址**，不代表真实系统内存布局。
