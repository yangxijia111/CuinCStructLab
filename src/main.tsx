import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { App } from './App';
import './app.css';

const rootEl = document.getElementById('root');
if (rootEl === null) {
  throw new Error('找不到 #root 挂载点');
}

createRoot(rootEl).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
);
