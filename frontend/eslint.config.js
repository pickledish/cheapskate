import js from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import pluginVue from 'eslint-plugin-vue';
import globals from 'globals';
import { withVueTs, vueTsConfigs } from '@vue/eslint-config-typescript';

export default withVueTs(
  {
    // Require <script lang="ts"> in all Vue SFCs (vue/block-lang).
    scriptLangs: ['ts'],
    rootDir: import.meta.dirname,
  },
  {
    ignores: ['dist/**', 'node_modules/**'],
  },
  {
    files: ['**/*.{js,ts,vue}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: globals.browser,
    },
    rules: {
      'vue/v-bind-style': ['error', 'longform'],
      'vue/v-on-style': ['error', 'longform'],
      'vue/v-slot-style': ['error', 'longform'],
      'vue/component-api-style': ['error', ['options']],
    },
  },
  js.configs.recommended,
  pluginVue.configs['flat/recommended'],
  vueTsConfigs.recommendedTypeChecked,
  // Plain JS config files aren't part of a TS project.
  vueTsConfigs.disableTypeChecked.map((config) => ({
    ...config,
    files: ['**/*.js'],
  })),
  eslintConfigPrettier,
);
