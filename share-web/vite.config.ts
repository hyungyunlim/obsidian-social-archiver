import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { visualizer } from 'rollup-plugin-visualizer';
import viteCompression from 'vite-plugin-compression';

export default defineConfig({
	plugins: [
		sveltekit(),
		// Gzip compression
		viteCompression({
			algorithm: 'gzip',
			ext: '.gz'
		}),
		// Brotli compression
		viteCompression({
			algorithm: 'brotliCompress',
			ext: '.br'
		}),
		// Bundle analyzer (only in build mode)
		visualizer({
			emitFile: true,
			filename: 'stats.html',
			open: false,
			gzipSize: true,
			brotliSize: true
		})
	],
	build: {
		// Optimize chunk splitting
		rollupOptions: {
			output: {
				manualChunks: (id) => {
					// Only chunk client-side modules
					if (id.includes('node_modules')) {
						if (id.includes('marked') || id.includes('dompurify')) {
							return 'markdown';
						}
					}
				}
			}
		},
		// Reduce chunk size warning limit
		chunkSizeWarningLimit: 500,
		// Enable minification
		minify: 'terser',
		terserOptions: {
			compress: {
				drop_console: true,
				drop_debugger: true
			}
		}
	},
	test: {
		include: ['src/**/*.{test,spec}.{js,ts}']
	}
});
