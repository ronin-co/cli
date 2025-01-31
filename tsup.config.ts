import { defineConfig } from 'tsup';

export default defineConfig(({ watch = false }) => ({
  clean: true,
  dts: true,
  entry: {
    index: './src/index.ts',
  },
  format: 'esm',
  watch,
}));
