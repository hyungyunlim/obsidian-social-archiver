import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

export default {
  preprocess: vitePreprocess(),
  compilerOptions: {
    // Enable Svelte 5 Runes mode
    runes: true,
    // Enable strict mode for better type safety
    strict: true,
    // Disable accessibility warnings for Obsidian UI
    accessors: false,
    // CSS handling
    css: 'injected'
  },
  // Hot module replacement configuration
  vitePlugin: {
    hot: true
  }
};