import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import obsidian from '@codewithcheese/vite-plugin-obsidian';
import path from 'path';

export default defineConfig({
  plugins: [
    svelte({
      compilerOptions: {
        // Enable Svelte 5 Runes mode
        runes: true
      }
    }),
    obsidian({
      manifest: './manifest.json'
    })
  ],
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/main.ts'),
      formats: ['cjs'],
      fileName: () => 'main.js'
    },
    rollupOptions: {
      external: ['obsidian'],
      output: {
        dir: '.',
        entryFileNames: 'main.js',
        assetFileNames: 'styles.css',
        globals: {
          obsidian: 'obsidian'
        }
      }
    },
    minify: process.env.NODE_ENV === 'production',
    sourcemap: 'inline',
    emptyOutDir: false,
    outDir: '.',
    cssCodeSplit: false
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@services': path.resolve(__dirname, './src/services'),
      '@utils': path.resolve(__dirname, './src/utils'),
      '@types': path.resolve(__dirname, './src/types'),
      '@stores': path.resolve(__dirname, './src/stores'),
      '@hooks': path.resolve(__dirname, './src/hooks')
    }
  },
  optimizeDeps: {
    exclude: ['obsidian']
  },
  server: {
    open: false,
    port: 5173,
    hmr: {
      protocol: 'ws',
      host: 'localhost'
    }
  }
});