/** @type {import('tailwindcss').Config} */
export default {
	content: ['./src/**/*.{html,js,svelte,ts}'],
	theme: {
		extend: {
			colors: {
				// Obsidian theme colors
				'bg-primary': 'var(--background-primary, #202020)',
				'bg-secondary': 'var(--background-secondary, #161616)',
				'text-normal': 'var(--text-normal, #dcddde)',
				'text-muted': 'var(--text-muted, #999999)',
				'text-accent': 'var(--text-accent, #7c7c7c)',
				'border-color': 'var(--background-modifier-border, #3a3a3a)'
			},
			fontFamily: {
				sans: [
					'var(--font-interface, -apple-system)',
					'BlinkMacSystemFont',
					'Segoe UI',
					'Roboto',
					'Helvetica Neue',
					'Arial',
					'sans-serif'
				]
			},
			spacing: {
				// iOS HIG minimum touch target: 44px
				touch: '44px'
			}
		}
	},
	plugins: [require('@tailwindcss/typography')],
	corePlugins: {
		// Disable preflight to avoid conflicts with Obsidian styling
		preflight: false
	}
};
