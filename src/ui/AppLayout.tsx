/**
 * 应用布局：左侧导航 + 顶部条（搜索入口、新手模式开关、主题切换）（UI_UX_SPEC §2）。
 */
import { NavLink, Outlet } from 'react-router-dom';
import { useAppStore } from './AppStore';

const NAV_ITEMS: Array<{ to: string; label: string; icon: string }> = [
  { to: '/', label: '首页', icon: '⌂' },
  { to: '/course', label: '课程', icon: '▤' },
  { to: '/structures', label: '数据结构', icon: '◫' },
  { to: '/algorithms', label: '算法', icon: '∑' },
  { to: '/lab', label: '可视化实验室', icon: '⚗' },
  { to: '/coding', label: '代码练习', icon: '⌨' },
  { to: '/bank', label: '题库', icon: '✎' },
  { to: '/wrong-book', label: '错题本', icon: '✗' },
  { to: '/stats', label: '学习统计', icon: '◔' },
  { to: '/settings', label: '设置', icon: '⚙' },
];

export function AppLayout(): React.ReactElement {
  const { theme, setTheme, beginnerMode, setBeginnerMode, storageError } = useAppStore();
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">C</span>
          <div className="brand-text">
            <strong>CuinCStructLab</strong>
            <span>C 数据结构学习平台</span>
          </div>
        </div>
        <nav className="nav" aria-label="主导航">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}
            >
              <span className="nav-icon" aria-hidden="true">
                {item.icon}
              </span>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <footer className="sidebar-foot">v1.0.1 · 本地学习，无需联网</footer>
      </aside>
      <div className="main-area">
        <header className="topbar">
          <NavLink to="/search" className="topbar-search" aria-label="全局搜索">
            🔍 搜索知识点 / 题目…
          </NavLink>
          <div className="topbar-actions">
            <button
              type="button"
              className={beginnerMode ? 'topbar-toggle on' : 'topbar-toggle'}
              onClick={() => setBeginnerMode(!beginnerMode)}
              title="新手模式：每步显示更详细的解释"
            >
              新手模式 {beginnerMode ? '开' : '关'}
            </button>
            <button
              type="button"
              className="topbar-toggle"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              title="切换明暗主题"
            >
              {theme === 'dark' ? '☀ 亮色' : '☾ 暗色'}
            </button>
          </div>
        </header>
        {storageError !== null && (
          <div className="storage-error-banner" role="alert">
            ⚠ {storageError}
            <button type="button" className="banner-close" aria-label="关闭" onClick={() => undefined}>×</button>
          </div>
        )}
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
