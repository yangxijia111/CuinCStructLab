/**
 * 代码练习页（FR-COD）：CodeMirror 编辑器 + 本地判题 + 用例展示 + 无编译器降级。
 * 浏览器模式：可读题/写码/看用例与参考答案；判题需要本地编译器（桌面版或 Node 环境）。
 */
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import CodeMirror from '@uiw/react-codemirror';
import { cpp } from '@codemirror/lang-cpp';
import { CODING_PROBLEMS } from '../coding/problems';
import type { CodingProblem } from '../coding/problems';
import { detectCompilers } from '../runner/runner';
import type { RunnerAvailability } from '../runner/runner';
import { compileAndRun } from '../runner/runner';
import { judgeSubmission } from '../judge/judge';
import type { JudgeOutput } from '../judge/judge';
import { JUDGE_STATUS_LABELS } from '../judge/judge';
import { useAppStore } from '../ui/AppStore';
import { getDb } from '../storage/db';
import { saveSubmission } from '../storage/repos';

export function CodingPage(): React.ReactElement {
  const [params] = useSearchParams();
  const chapterParam = params.get('chapter');
  const [problemId, setProblemId] = useState<string | null>(() => {
    if (chapterParam !== null) {
      const first = CODING_PROBLEMS.find((p) => p.chapter === Number(chapterParam));
      if (first !== undefined) return first.id;
    }
    return null;
  });
  const [availability, setAvailability] = useState<RunnerAvailability | null>(null);
  const { withDbRef } = useCodingPersistence();

  useEffect(() => {
    void detectCompilers().then(setAvailability);
  }, []);

  const problem = problemId === null ? null : (CODING_PROBLEMS.find((p) => p.id === problemId) ?? null);

  return (
    <div className="coding-page">
      <aside className="coding-list">
        <h2>代码练习</h2>
        {availability !== null && !availability.available && (
          <div className="runner-warn">
            <strong>本地判题不可用</strong>
            <p>{availability.reason}</p>
            <p className="runner-hint">{availability.installHint}</p>
            <p className="runner-hint">在此之前你可以阅读题目、编写代码、查看测试用例与参考答案。</p>
          </div>
        )}
        <ol>
          {CODING_PROBLEMS.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                className={problemId === p.id ? 'coding-item active' : 'coding-item'}
                onClick={() => setProblemId(p.id)}
              >
                <span className="coding-ch">Ch{p.chapter}</span>
                <span>{p.title}</span>
                <span className="coding-diff">{'★'.repeat(p.difficulty)}</span>
              </button>
            </li>
          ))}
        </ol>
      </aside>
      <main className="coding-main">
        {problem === null ? (
          <div className="panel coding-empty">
            <p>从左侧选择一道编程题。</p>
            <p className="empty-hint">{CODING_PROBLEMS.length} 道题覆盖顺序表/链表/栈/队列/BST/查找/排序。</p>
          </div>
        ) : (
          <ProblemWorkbench key={problem.id} problem={problem} availability={availability} onPersist={withDbRef} />
        )}
      </main>
    </div>
  );
}

/** 提交记录持久化 */
function useCodingPersistence(): { withDbRef: (fn: (db: import('../storage/db').AppDatabase) => void) => void } {
  const { recordAttempt } = useAppStore();
  return {
    withDbRef: (fn) => {
      void getDb()
        .then(fn)
        .catch(() => undefined);
      void recordAttempt;
    },
  };
}

function ProblemWorkbench({
  problem,
  availability,
  onPersist,
}: {
  problem: CodingProblem;
  availability: RunnerAvailability | null;
  onPersist: (fn: (db: import('../storage/db').AppDatabase) => void) => void;
}): React.ReactElement {
  const [code, setCode] = useState(problem.template);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<JudgeOutput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showReference, setShowReference] = useState(false);

  const extensions = useMemo(() => [cpp()], []);

  const run = async (): Promise<void> => {
    if (availability === null || !availability.available || availability.compiler === null) {
      setError('本地判题不可用：需要桌面版应用或安装 C 编译器（见左侧安装指引）。');
      return;
    }
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const outcome = await compileAndRun(availability.compiler, code, problem.harness, problem.testCases, problem.timeLimitMs ?? 5000);
      const judged = judgeSubmission({
        compileExitCode: outcome.compileExitCode,
        compileStderr: `${outcome.compileStdout}\n${outcome.compileStderr}`,
        cases: outcome.cases,
        timeLimitMs: problem.timeLimitMs ?? 5000,
      });
      setResult(judged);
      onPersist((db) => saveSubmission(db, problem.id, judged.status, code, JSON.stringify({ passed: judged.passedCount, total: judged.totalCases })));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="problem-workbench">
      <div className="pw-left">
        <section className="panel pw-statement">
          <header>
            <h3>{problem.title}</h3>
            <span className="pw-meta">
              第 {problem.chapter} 章 · {'★'.repeat(problem.difficulty)} · {problem.testCases.length} 组用例
            </span>
          </header>
          <pre className="pw-statement-text">{problem.statement}</pre>
          <div className="pw-signature">
            <span>函数签名</span>
            <code>{problem.signature}</code>
          </div>
        </section>

        <section className="panel pw-cases">
          <h4>测试用例</h4>
          <div className="pw-case-list">
            {problem.testCases.map((c, i) => (
              <details key={i} className="pw-case">
                <summary>
                  用例 {i + 1}
                  {c.explanation !== undefined ? `（${c.explanation}）` : ''}
                </summary>
                <div className="pw-case-body">
                  <div>
                    <strong>输入</strong>
                    <pre>{c.stdin}</pre>
                  </div>
                  <div>
                    <strong>期望输出</strong>
                    <pre>{c.expected === '' ? '（空）' : c.expected}</pre>
                  </div>
                </div>
              </details>
            ))}
          </div>
          <button type="button" className="btn" onClick={() => setShowReference(!showReference)}>
            {showReference ? '隐藏参考答案' : '查看参考答案'}
          </button>
          {showReference && <pre className="pw-reference">{problem.referenceSolution}</pre>}
        </section>
      </div>

      <div className="pw-right">
        <div className="pw-editor panel">
          <div className="pw-editor-head">
            <span>main.c（在 TODO 处编写你的实现）</span>
            <button type="button" className="btn primary" onClick={() => void run()} disabled={running}>
              {running ? '判题中…' : '▶ 运行判题'}
            </button>
            <button type="button" className="btn" onClick={() => setCode(problem.template)}>
              重置模板
            </button>
          </div>
          <CodeMirror value={code} extensions={extensions} onChange={setCode} height="420px" theme="dark" basicSetup={{ tabSize: 4 }} />
        </div>

        {error !== null && <div className="pw-error" role="alert">⚠ {error}</div>}

        {result !== null && (
          <section className="panel pw-result">
            <header className={result.status === 'accepted' ? 'pw-status ok' : 'pw-status bad'}>
              {JUDGE_STATUS_LABELS[result.status]}
              <span>
                用例 {result.passedCount}/{result.totalCases}
              </span>
            </header>
            {result.status === 'compile_error' && <pre className="pw-compile-msg">{result.compileMessage}</pre>}
            {result.status === 'wrong_answer' && result.failedCase !== null && (
              <div className="pw-wa">
                <p>首个未通过用例：</p>
                <div className="pw-case-body">
                  <div>
                    <strong>输入</strong>
                    <pre>{result.failedCase.stdin}</pre>
                  </div>
                  <div>
                    <strong>Expected</strong>
                    <pre>{result.failedCase.expected === '' ? '（空）' : result.failedCase.expected}</pre>
                  </div>
                  <div>
                    <strong>Actual</strong>
                    <pre>{result.failedCase.actual === '' ? '（空）' : result.failedCase.actual}</pre>
                  </div>
                </div>
                {result.diff !== null && (
                  <p className="pw-diff">
                    第 {result.diff.lineNo} 行：期望「{result.diff.expected}」实际「{result.diff.actual}」
                  </p>
                )}
              </div>
            )}
            {result.status === 'time_limit_exceeded' && <p>超过时间限制（默认 5 秒/用例）。检查是否有死循环。</p>}
            {result.status === 'runtime_error' && (
              <p>
                运行时错误（{result.compileMessage}）。常见原因：野指针解引用、数组越界、除零、递归过深栈溢出。
              </p>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
