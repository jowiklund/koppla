import { resolve } from 'path';
import { defineConfig } from 'vite';
import dts from "vite-plugin-dts";

export default defineConfig(() => {
  const packageName = process.env.PACKAGE_NAME;
  const isWatchMode = process.argv.includes('--watch');

  if (!packageName) {
    throw new Error(
      'PACKAGE_NAME environment variable is not set. Please run build from a package-specific script.'
    );
  }

  return {
    root: __dirname,
    plugins: [
      dts({
        root: resolve(__dirname, `packages/${process.env.PACKAGE_NAME}/src`),
        outputDir: resolve(__dirname, `packages/${process.env.PACKAGE_NAME}/dist`),
        fileName: (entryName) => `${entryName}.d.ts`,
        clearPureImport: false,
      })
    ],
    build: {
      lib: {
        entry: resolve(__dirname, `packages/${packageName}/src/index.js`),
        name: `Koppla${packageName.charAt(0).toUpperCase() + packageName.slice(1)}`,
        formats: ['es', 'umd'],
        fileName: (format) => `${packageName}.${format}.js`,
      },
      watch: isWatchMode ? {
        clearScreen: false,
      } : null,
      outDir: resolve(__dirname, `packages/${packageName}/dist`),
      rollupOptions: {
        external: (id) => id.startsWith('@kpla/'),
      },
    },
  };
});
