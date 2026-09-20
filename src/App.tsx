import { Routes, Route } from 'react-router-dom';

/**
 * 应用根组件：P0 阶段为最小骨架，后续 Phase 逐步接入布局与页面。
 */
export function App(): React.ReactElement {
  return (
    <Routes>
      <Route path="/" element={<HomePlaceholder />} />
    </Routes>
  );
}

function HomePlaceholder(): React.ReactElement {
  return (
    <main className="page">
      <h1>CuinCStructLab</h1>
      <p>面向 C 语言初学者的数据结构学习平台（脚手架阶段）</p>
    </main>
  );
}
