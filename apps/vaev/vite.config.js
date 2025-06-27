import { defineConfig } from 'vite';

export default defineConfig(() => {
  const isWatchMode = process.argv.includes('--watch');

  return {
    root: __dirname,
    build: {
      lib: {
        entry: `./frontend/js/index.js`,
        name: `vaev`,
        formats: ['es'],
        fileName: `index`,
      },
      watch: isWatchMode ? {
        clearScreen: false,
      } : null,
      outDir: "./dist",
      rollupOptions: {
        external: (id) => id.startsWith('@kpla/'),
      },
    },
  };
});

