import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// 每个用例后清理 React DOM，避免泄漏与串扰
afterEach(() => {
  cleanup();
});
