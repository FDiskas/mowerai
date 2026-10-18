import { defineConfig } from 'vite'

/** Bundles the command-line tools (training and benchmark) for Node: `npm run train`, `npm run benchmark`. */
export default defineConfig({
  build: {
    ssr: true,
    outDir: 'dist-cli',
    emptyOutDir: true,
    target: 'node22',
    rollupOptions: {
      input: {
        benchmark: 'scripts/benchmark.ts',
        train: 'scripts/train.ts',
        simWorker: 'scripts/simWorker.ts',
      },
      output: { format: 'es', entryFileNames: '[name].js', chunkFileNames: '[name]-[hash].js' },
    },
  },
})
