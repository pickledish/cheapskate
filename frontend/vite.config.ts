import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';
import { execSync } from 'child_process';

const GITHUB_REPOSITORY = process.env.GITHUB_REPOSITORY ?? 'pickledish/cheapskate';

function getGitCommitHash(): string {
  try {
    return execSync('git rev-parse --short HEAD').toString().trim();
  } catch {
    return 'unknown';
  }
}

function githubUrl(path: string): string {
  return `https://github.com/${GITHUB_REPOSITORY}/${path}`;
}

function getCommitUrl(commitHash: string): string {
  if (commitHash === 'unknown') return '';
  return githubUrl(`commit/${commitHash}`);
}

function getWorkflowRunUrl(): string {
  const runId = process.env.GITHUB_RUN_ID;
  if (!runId) return '';
  return githubUrl(`actions/runs/${runId}`);
}

const commitHash = getGitCommitHash();

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@shared': resolve(__dirname, '../supabase/functions/_shared'),
      zod: resolve(__dirname, 'node_modules/zod'),
    },
  },
  optimizeDeps: {
    include: ['zod'],
  },
  define: {
    __COMMIT_HASH__: JSON.stringify(commitHash),
    __COMMIT_URL__: JSON.stringify(getCommitUrl(commitHash)),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    __WORKFLOW_RUN_URL__: JSON.stringify(getWorkflowRunUrl()),
  },
});
