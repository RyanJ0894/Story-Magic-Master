module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  // Minimal ruleset — orchestrator code predates this config.
  // Expand rules incrementally as tech debt is addressed.
  rules: {},
  ignorePatterns: ['src/generated/', 'dist/', 'node_modules/', 'tests/'],
};
