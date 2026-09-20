import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  // 忽略构建产物
  { ignores: ['dist', 'dist-electron', 'coverage', 'node_modules'] },

  // 基础 JS 规则（应用于所有文件）
  js.configs.recommended,

  // 严格 typed 规则只应用于 TS 源码
  {
    files: ['**/*.{ts,tsx}'],
    extends: [...tseslint.configs.strictTypeChecked],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
      parserOptions: {
        tsconfigRootDir: import.meta.dirname,
        projectService: true,
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      // 项目质量红线（对应 TEST_PLAN §1：不得以 any 绕过类型）
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/only-throw-error': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      // strictTypeChecked 中对教学代码过于苛刻的风格规则，显式关闭（tsc strict 仍然全量生效）：
      '@typescript-eslint/restrict-template-expressions': 'off', // 模板串内嵌数字/布尔是常态
      '@typescript-eslint/no-non-null-assertion': 'off', // 已知非空场景允许 !
      '@typescript-eslint/no-unnecessary-condition': 'off', // 允许防御性条件
      '@typescript-eslint/no-unnecessary-type-assertion': 'off',
      '@typescript-eslint/no-meaningless-void-operator': 'off',
      '@typescript-eslint/no-confusing-void-expression': 'off',
      '@typescript-eslint/prefer-nullish-coalescing': 'off',
      '@typescript-eslint/no-dynamic-delete': 'off', // Record<id, node> 按动态 id 删除是数据结构核心操作
      '@typescript-eslint/unbound-method': 'off', // Context/回调全部为 useCallback 闭包，不依赖 this
    },
  },

  // Electron 主进程（CJS，Node 环境）
  {
    files: ['electron/**/*.cjs'],
    languageOptions: {
      globals: globals.node,
    },
  },

  // JS 文件与构建配置（含本配置）禁用需要类型信息的规则
  {
    files: ['**/*.js', 'vite.config.ts'],
    ...tseslint.configs.disableTypeChecked,
  },

  // 测试文件放宽需要 fixture 场景的 unsafe 规则
  {
    files: ['**/*.test.{ts,tsx}', 'src/test/**'],
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
    },
  },

  // 架构边界：core/ 为纯 TS 层，禁止依赖任何 UI/平台模块（ARCHITECTURE.md §2）
  {
    files: ['src/core/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['react', 'react-dom', 'react/*'], message: 'core/ 不得依赖 React（ARCHITECTURE.md 依赖规则）' },
            { group: ['src/ui/*', 'src/pages/*', 'src/visualization/*'], message: 'core/ 不得依赖 UI 层' },
          ],
        },
      ],
    },
  },
);
