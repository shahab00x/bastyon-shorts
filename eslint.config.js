import antfu from '@antfu/eslint-config'

export default antfu(
  {
    unocss: true,
    formatters: true,
    ignores: [
      '**/node_modules',
      '**/dist',
      '**/.git',
      '**/.nuxt',
      '**/.output',
      '**/.cache',
      '**/.temp',
      '**/coverage',
    ],
    rules: {
      'no-console': 'off',
      'no-var': 'off',
      'vars-on-top': 'off',
      'no-restricted-globals': 'off',
      'jsonc/sort-keys': 'off',
    },
  },
  {
    files: ['**/*.ts', '**/*.js'],
    rules: {
      'no-restricted-globals': ['error', 'isFinite', 'isNaN', 'name', 'length', 'event', 'top', 'parent', 'self', 'close', 'status', 'origin'],
    },
  },
)
