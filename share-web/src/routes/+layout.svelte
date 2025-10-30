<script lang="ts">
	import '../app.css';

	let { children } = $props();
</script>

<a href="#main-content" class="skip-link">Skip to main content</a>

<main id="main-content" tabindex="-1">
	{@render children()}
</main>

<style>
	/* Skip link for keyboard navigation accessibility */
	.skip-link {
		position: absolute;
		top: -40px;
		left: 0;
		background: var(--text-accent, #4a9eff);
		color: white;
		padding: 0.5rem 1rem;
		text-decoration: none;
		z-index: 100000;
		border-radius: 0 0 0.25rem 0;
		font-weight: 500;
		transition: top 0.15s ease;
	}

	.skip-link:focus {
		top: 0;
		outline: 2px solid var(--text-accent, #4a9eff);
		outline-offset: 2px;
	}

	/* Ensure main content can receive focus */
	#main-content:focus {
		outline: none;
	}

	/* Respect user motion preferences */
	@media (prefers-reduced-motion: reduce) {
		.skip-link {
			transition: none;
		}
	}
</style>