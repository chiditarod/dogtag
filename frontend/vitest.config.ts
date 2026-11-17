import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./src/test/setup.ts'],
      css: false,
      // The 2-vCPU CI container is far slower than a laptop; big forms need the headroom.
      testTimeout: 15000,
    },
  }),
);
