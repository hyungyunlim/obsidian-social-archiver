<script lang="ts">
	import { onMount } from 'svelte';
	import type { Snippet } from 'svelte';

	interface Props {
		fallback?: () => void;
		resetButtonText?: string;
		showDetails?: boolean;
		children?: Snippet;
	}

	let {
		fallback,
		resetButtonText = 'Try Again',
		showDetails = false,
		children
	}: Props = $props();

	let error = $state<Error | null>(null);
	let errorDetails = $state<string>('');

	function handleError(e: Error) {
		error = e;
		errorDetails = `${e.message}\n${e.stack}`;
		console.error('[ErrorBoundary]', e);

		// Call fallback if provided
		if (fallback) {
			fallback();
		}
	}

	function reset() {
		error = null;
		errorDetails = '';
		// Reload the page to reset the error state
		window.location.reload();
	}

	onMount(() => {
		// Set up global error handler
		const handleWindowError = (event: ErrorEvent) => {
			handleError(new Error(event.message));
		};

		const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
			handleError(new Error(`Unhandled promise rejection: ${event.reason}`));
		};

		window.addEventListener('error', handleWindowError);
		window.addEventListener('unhandledrejection', handleUnhandledRejection);

		return () => {
			window.removeEventListener('error', handleWindowError);
			window.removeEventListener('unhandledrejection', handleUnhandledRejection);
		};
	});
</script>

{#if error}
	<div class="error-boundary">
		<div class="error-content">
			<svg
				class="error-icon"
				width="64"
				height="64"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
			>
				<circle cx="12" cy="12" r="10" />
				<line x1="12" y1="8" x2="12" y2="12" />
				<line x1="12" y1="16" x2="12" y2="16" />
			</svg>

			<h2 class="error-title">Oops! Something went wrong</h2>
			<p class="error-message">
				We're sorry, but an unexpected error occurred. Please try refreshing the page.
			</p>

			{#if showDetails && errorDetails}
				<details class="error-details">
					<summary>Error Details</summary>
					<pre>{errorDetails}</pre>
				</details>
			{/if}

			<div class="error-actions">
				<button onclick={reset} class="reset-button">
					{resetButtonText}
				</button>
				<a href="/" class="home-link">Go Home</a>
			</div>
		</div>
	</div>
{:else}
	{@render children?.()}
{/if}

<style>
	.error-boundary {
		min-height: 100vh;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 2rem;
		background: var(--bg-primary, white);
	}

	.error-content {
		max-width: 500px;
		text-align: center;
		padding: 2rem;
	}

	.error-icon {
		color: var(--text-error, #ff4444);
		margin-bottom: 1.5rem;
	}

	.error-title {
		font-size: 1.5rem;
		font-weight: 600;
		color: var(--text-normal, #1a1a1a);
		margin: 0 0 0.75rem 0;
	}

	.error-message {
		color: var(--text-muted, #666);
		margin: 0 0 1.5rem 0;
		line-height: 1.6;
	}

	.error-details {
		background: var(--bg-secondary, #f5f5f5);
		border-radius: 0.5rem;
		padding: 1rem;
		margin: 1.5rem 0;
		text-align: left;
	}

	.error-details summary {
		cursor: pointer;
		font-weight: 500;
		color: var(--text-muted, #666);
		margin-bottom: 0.5rem;
	}

	.error-details pre {
		font-size: 0.75rem;
		white-space: pre-wrap;
		word-break: break-word;
		color: var(--text-error, #ff4444);
		margin: 0.5rem 0 0 0;
		max-height: 200px;
		overflow-y: auto;
	}

	.error-actions {
		display: flex;
		gap: 1rem;
		justify-content: center;
		margin-top: 1.5rem;
	}

	.reset-button,
	.home-link {
		padding: 0.75rem 1.5rem;
		border-radius: 0.5rem;
		font-weight: 500;
		text-decoration: none;
		transition: all 0.2s ease;
		cursor: pointer;
		border: none;
		font-size: 0.875rem;
	}

	.reset-button {
		background: var(--text-accent, #4a9eff);
		color: white;
	}

	.reset-button:hover {
		background: var(--text-normal, #357ac0);
	}

	.home-link {
		background: var(--bg-secondary, #f5f5f5);
		color: var(--text-normal, #1a1a1a);
	}

	.home-link:hover {
		background: var(--bg-tertiary, #e5e5e5);
	}

	/* Dark mode support */
	@media (prefers-color-scheme: dark) {
		.error-boundary {
			background: var(--bg-primary, #1a1a1a);
		}

		.error-details {
			background: rgba(255, 255, 255, 0.05);
		}

		.home-link {
			background: rgba(255, 255, 255, 0.1);
			color: var(--text-normal, white);
		}

		.home-link:hover {
			background: rgba(255, 255, 255, 0.15);
		}
	}
</style>