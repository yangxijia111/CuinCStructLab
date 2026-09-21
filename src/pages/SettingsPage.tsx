/**
 * 设置页（FR-UI + FR-DATA-04）：主题 / 新手模式 / 编译器路径 / 数据导出导入 / 清空数据（二次确认）。
 */
import { useEffect, useState } from 'react';
import { useAppStore } from '../ui/AppStore';
import { detectCompilers } from '../runner/runner';
import type { RunnerAvailability } from '../runner/runner';

export function SettingsPage(): React.ReactElement {
  const { theme, setTheme, beginnerMode, setBeginnerMode, exportData, resetAllData, storageError } = useAppStore();
  const [compilerPath, setCompilerPath] = useState('');
  const [availability, setAvailability] = useState<RunnerAvailability | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    void detectCompilers(compilerPath.trim() === '' ? undefined : compilerPath.trim()).then(setAvailability);
    // 仅在挂载时探测一次默认环境
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const doExport = async (): Promise<void> => {
    try {
      const json = await exportData();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cuincstructlab-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setMessage('已导出备份 JSON（含进度/答题/错题/笔记/收藏/设置）。');
    } catch (err) {
      setMessage(`导出失败：${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const doClear = async (): Promise<void> => {
    // 统一 API：关闭并删除底层数据库（Web: IndexedDB；桌面: userData 文件）+ 重置内存态
    try {
      await resetAllData();
      setMessage('数据已清空。页面即将刷新…');
      setTimeout(() => {
        window.location.reload();
      }, 800);
    } catch (err) {
      setMessage(`清空失败：${err instanceof Error ? err.message : String(err)}`);
      setConfirmClear(false);
    }
  };

  return (
    <div className="page settings-page">
      <h1>设置</h1>
      {storageError !== null && <div className="storage-error-banner" role="alert">⚠ {storageError}</div>}

      <section className="panel settings-section">
        <h3>外观与学习</h3>
        <div className="setting-row">
          <span>主题</span>
          <div className="setting-actions">
            <button type="button" className={theme === 'dark' ? 'btn on' : 'btn'} onClick={() => setTheme('dark')}>
              暗色（默认）
            </button>
            <button type="button" className={theme === 'light' ? 'btn on' : 'btn'} onClick={() => setTheme('light')}>
              亮色
            </button>
          </div>
        </div>
        <div className="setting-row">
          <span>新手模式（每步显示更详细的解释）</span>
          <div className="setting-actions">
            <button type="button" className={beginnerMode ? 'btn on' : 'btn'} onClick={() => setBeginnerMode(!beginnerMode)}>
              {beginnerMode ? '已开启' : '已关闭'}
            </button>
          </div>
        </div>
      </section>

      <section className="panel settings-section">
        <h3>本地判题（C 编译器）</h3>
        {availability === null ? (
          <p className="empty-hint">探测中…</p>
        ) : availability.available ? (
          <p className="setting-ok">
            ✓ 已找到编译器：{availability.compiler?.kind}（{availability.compiler?.version}）
          </p>
        ) : (
          <div className="runner-warn">
            <p>{availability.reason}</p>
            <p className="runner-hint">{availability.installHint}</p>
          </div>
        )}
        <div className="setting-row">
          <span>自定义编译器路径（可选，优先于自动探测）</span>
          <input
            className="setting-input"
            value={compilerPath}
            placeholder="如 C:\\msys64\\mingw64\\bin\\gcc.exe"
            onChange={(e) => setCompilerPath(e.target.value)}
          />
        </div>
        <p className="empty-hint">说明：本地编译运行不是安全沙箱，详见 SECURITY.md。</p>
      </section>

      <section className="panel settings-section">
        <h3>数据</h3>
        <p className="empty-hint">
          学习数据保存在本地（IndexedDB / SQLite），不联网。建议定期导出备份。
        </p>
        <div className="setting-actions">
          <button type="button" className="btn primary" onClick={() => void doExport()}>
            导出全部数据（JSON）
          </button>
          {confirmClear ? (
            <>
              <button type="button" className="btn danger" onClick={() => void doClear()}>
                确认清空全部数据
              </button>
              <button type="button" className="btn" onClick={() => setConfirmClear(false)}>
                取消
              </button>
            </>
          ) : (
            <button type="button" className="btn danger" onClick={() => setConfirmClear(true)}>
              清空全部数据…
            </button>
          )}
        </div>
        {confirmClear && <p className="setting-danger-text">将删除全部学习进度、答题记录、错题、笔记与收藏，不可恢复。</p>}
      </section>

      {message !== null && <div className="lab-message" role="status">{message}</div>}

      <section className="panel settings-section">
        <h3>关于</h3>
        <p className="empty-hint">CuinCStructLab v1.0 · 面向 C 语言初学者的数据结构学习平台 · 本地运行，无需联网</p>
      </section>
    </div>
  );
}
