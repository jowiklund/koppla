import { defineConfig } from 'vite';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig(() => {
  const isWatchMode = process.argv.includes('--watch');

  return {
    base: "./",
    plugins: [
    ],
    build: {
      minify: "terser",
      terserOptions: {
        keep_classnames: true,
        keep_fnames: true
      },
      outDir: resolve(__dirname, 'dist'),
      emptyOutDir: !isWatchMode,
      watch: isWatchMode ? { clearScreen: false } : null,
      rollupOptions: {
        input: {
            index: resolve(__dirname, 'frontend/js/index.js'),
            graph: resolve(__dirname, 'frontend/js/graph.js'),
            style: resolve(__dirname, 'frontend/css/style.css'),
            intro: resolve(__dirname, 'frontend/css/intro.css'),
            projects: resolve(__dirname, 'frontend/css/dashboard.css'),
        },
        output: {
          entryFileNames: `[name].js`,
          assetFileNames: `[name].[ext]`,
        }
      },
    },

    server: {
      port: 5173,
        hmr: {
        overlay: false
      }
    }
  };
});
