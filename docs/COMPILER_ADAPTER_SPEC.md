# Compiler Adapter Specification

> P15 配套规格。定义编译器适配层的统一接口、各适配器行为、探测协议与失败分类。
> 状态：实施中（P15-D）。

## 1. 动机

现状（`electron/runner-core.cjs`）把编译器差异散落在三处：`buildCompileArgs` 的 `kind === 'cl'` 分支、`detectCompiler` 的候选表、`guessKind` 的路径子串猜测。已知缺陷：

- customPath 统一 `--version`，MSVC `cl.exe` 不支持；
- 只验证"进程能启动"，不验证版本输出签名，任意 exe 可被误判为 gcc；
- 版本探测只读 stdout，MSVC banner 输出在 stderr；
- cl 探测不检查 INCLUDE/LIB 环境（Developer Command Prompt 未初始化时误报可用）。

## 2. 统一接口

实现文件：`electron/compiler-adapters.cjs`（CommonJS，主进程与 Node 测试共用；工厂 `createCompilerAdapters(execProbe)` 接受可注入的探测函数，生产传真实 spawn 版，测试传 mock）。

```ts
interface AdapterProbeResult {
  ran: boolean;          // 进程能否启动（spawn error → false）
  exitCode: number | null;
  signal: string | null;
  stdout: string;        // 探测必须同时收集 stdout 与 stderr
  stderr: string;
  durationMs: number;
}

interface CompilerAdapter {
  kind: 'gcc' | 'clang' | 'cl';
  /** 版本探测 argv（cl 为 []：无参数运行打 banner） */
  versionArgs(): string[];
  /** 版本签名：探测输出必须匹配才认定是该编译器（防任意 exe 冒充） */
  versionSignature(): RegExp;
  /** 从探测输出解析人类可读版本串；无法解析返回 null */
  parseVersion(stdout: string, stderr: string): string | null;
  /** 编译参数（binaryPath 目标程序，sourcePath 输入源码） */
  buildCompileArgs(binaryPath: string, sourcePath: string): string[];
  /** 单候选探测： ran && 签名匹配 → ok */
  probe(cmd: string): Promise<ProbeOutcome>;
  /** 能力声明 */
  supports(): { c99: boolean; signalExit: boolean; devEnvRequired: boolean };
  /** 环境诊断信息（MSVC 的 INCLUDE/LIB 检查在这里） */
  getEnvironmentInfo(): Record<string, string | boolean>;
  /** 失败分类（平台无关） */
  classifyExit(outcome: ProcessOutcome): ExitClass;
}

type ExitClass = 'ok' | 'nonzero_exit' | 'signal' | 'timeout' | 'spawn_error';
```

`detect(customPath?)` 入口协议（runner-core 委托）：

1. **customPath 非空**：按文件名优先猜测 adapter 顺序（如 `cl.exe` → 先 MsvcAdapter），对每个候选执行 `adapter.probe(path)`：
   - `ran=false` → 试下一个；全部失败 → 不可用（"路径无法执行"）。
   - `ran=true` 但无任何 adapter 签名匹配 → 不可用，reason 明确"该可执行文件不是受支持的 C 编译器（gcc/clang/cl）"。
2. **无 customPath**：PATH 探测顺序 gcc → clang → cl（Windows 另试已知安装位置），每个命令同样走 `adapter.probe`（签名验证）。
3. MSVC 特殊规则：
   - 探测命令 `cl`（无参数）：banner 在 stderr，`Microsoft (R)` 签名匹配即认定存在；
   - 存在但 `process.env.INCLUDE` 未定义 → `available: true` 但 reason 附带"cl.exe 存在，但 MSVC 开发环境未初始化（缺少 INCLUDE/LIB）。请在 Developer Command Prompt 中启动应用，或通过 vcvarsall.bat 初始化后使用自定义路径。"（不误判为正常可用：reason 非空即让上层 UI 可提示）。

## 3. 各适配器规格

### 3.1 GccAdapter

- `versionArgs`: `['--version']`；签名 `/gcc/i`（输出首行含 "gcc"）。
- `parseVersion`: stdout 首行（如 `gcc (Ubuntu 13.2.0) 13.2.0`）。
- `buildCompileArgs`: `['-std=c99', '-Wall', '-O0', '-o', binary, source]`（与现行为完全一致，不引入变化）。
- 源码编码：UTF-8（无 BOM），gcc 默认按字节处理，中文注释/字符串按字节精确比较（现状已验证）。

### 3.2 ClangAdapter

- 与 GCC 相同的 argv 约定（`--version` / `-std=c99 -Wall -O0 -o`）。
- 签名 `/clang/i`。注意 clang 输出形如 `Ubuntu clang version 17.0.6`；`gcc` 兼容模式（某些发行版 clang --version 提到 gcc）按先 clang 后 gcc 的 probe 顺序消歧。

### 3.3 MsvcAdapter

- `versionArgs`: `[]`（`cl --version` 不被支持；无参数运行打印 banner + 用法到 stderr，退出码非 0 属预期）。
- 签名：stderr 或 stdout 匹配 `/Microsoft \(R\).*C\/C\+\+|Version \d+\.\d+\.\d+/i`。
- `parseVersion`: 从 stderr 提取 `Version x.y.z` 行。
- `buildCompileArgs`: `['/nologo', '/W4', '/EHsc', '/std:c11', '/Fe:' + binary, source]`（新增 `/std:c11`：教学 C 代码使用 C99 for 循环内声明）。
- `.exe` 后缀由 runner-core 按平台处理（Windows 目标名固定 `program.exe`）。
- `supports().devEnvRequired = true`；`getEnvironmentInfo()` 返回 `{ hasInclude: !!process.env.INCLUDE, hasLib: !!process.env.LIB }`，探测结论据此附加环境未初始化提示。

## 4. customPath 消歧规则（修复 D1/D2/D5）

```
guessOrder(path):
  basename 含 'clang'            → [Clang, Gcc, Msvc]
  basename 是 cl / cl.exe        → [Msvc, Gcc, Clang]
  其他（含 gcc / cc / 未知）     → [Gcc, Clang, Msvc]
```

- 顺序内逐个 probe（真实运行 versionArgs 并验证签名），首个签名匹配者胜出 —— 文件名只影响尝试顺序，**结论由签名决定**，路径命名无法欺骗。
- 明确禁止：仅凭 `spawn` 成功或退出码 0 判定可用。

## 5. classifyExit（平台无关失败分类）

输入 `ProcessOutcome { exitCode, signal, timedOut, spawnError, durationMs }`：

| 条件（按序） | 分类 |
|---|---|
| `spawnError !== null` | `spawn_error` |
| `timedOut` | `timeout` |
| `signal !== null`（SIGSEGV/SIGABRT/SIGKILL/Windows 异常终止映射） | `signal` |
| `exitCode !== 0` | `nonzero_exit` |
| 否则 | `ok` |

判题映射（`src/judge`）：`ok` 才允许进入输出比对；`spawn_error`/`signal`/`nonzero_exit` → Runtime Error；`timeout` → TLE（优先级高于 RE）。

## 6. 测试要求

- `tests/compiler-adapters/`：mock `execProbe`（stdout/stderr/exitCode/signal 可控）验证：
  - GCC/Clang 版本解析、签名不匹配拒绝（如把 node 的输出喂给 GccAdapter 必须 fail）；
  - MSVC banner 在 stderr 的解析、`INCLUDE` 缺失时的提示文案；
  - customPath 消歧：路径名含 clang 的 gcc、任意 exe（输出无签名）、cl.exe。
- 真实验证：CI ubuntu（gcc/clang 真机探测 + 全量判题/差分）、CI windows（msvc-dev-cmd 初始化后真 cl）。
