<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import type { Platform } from '../../types/post';
  import { getPlatformByDomain, PLATFORM_CONFIGS } from '../../types/platform';

  /**
   * Props
   */
  interface Props {
    url?: string;
    placeholder?: string;
    autofocus?: boolean;
  }

  let {
    url = $bindable(''),
    placeholder = 'Paste social media URL here...',
    autofocus = true
  }: Props = $props();

  /**
   * Component state using Svelte 5 runes
   */
  let inputRef: HTMLInputElement | undefined;
  let platform = $state<Platform | null>(null);
  let isValid = $state(false);
  let isValidating = $state(false);
  let error = $state<string | null>(null);
  let showClearButton = $state(false);

  /**
   * Event dispatcher
   */
  const dispatch = createEventDispatcher<{
    change: {
      url: string;
      platform: Platform | null;
      valid: boolean;
      error: string | null;
    };
  }>();

  /**
   * Validation timeout for debouncing
   */
  let validationTimeout: ReturnType<typeof setTimeout> | null = null;

  /**
   * Platform icon and color
   */
  const platformInfo = $derived(() => {
    if (!platform) return null;

    const config = PLATFORM_CONFIGS[platform];
    const icons: Record<Platform, string> = {
      facebook: '📘',
      linkedin: '💼',
      instagram: '📸',
      tiktok: '🎵',
      x: '✖️',
      threads: '🧵'
    };

    const colors: Record<Platform, string> = {
      facebook: '#1877f2',
      linkedin: '#0077b5',
      instagram: '#E4405F',
      tiktok: '#000000',
      x: '#000000',
      threads: '#000000'
    };

    return {
      icon: icons[platform],
      color: colors[platform],
      displayName: config.displayName
    };
  });

  /**
   * Validate URL
   */
  async function validateUrl(urlString: string) {
    // Reset state
    platform = null;
    isValid = false;
    error = null;

    if (!urlString.trim()) {
      showClearButton = false;
      dispatchChange();
      return;
    }

    showClearButton = true;
    isValidating = true;

    try {
      // Parse URL
      const urlObj = new URL(urlString);
      const domain = urlObj.hostname;

      // Detect platform
      const detectedPlatform = getPlatformByDomain(domain);

      if (!detectedPlatform) {
        error = 'Unsupported platform. Please use Facebook, LinkedIn, Instagram, TikTok, X, or Threads.';
        isValid = false;
      } else {
        platform = detectedPlatform;
        isValid = true;
        error = null;
      }
    } catch (err) {
      error = 'Invalid URL format';
      isValid = false;
      platform = null;
    } finally {
      isValidating = false;
      dispatchChange();
    }
  }

  /**
   * Handle input change with debouncing
   */
  function handleInput(event: Event) {
    const input = event.target as HTMLInputElement;
    url = input.value;

    // Clear previous timeout
    if (validationTimeout) {
      clearTimeout(validationTimeout);
    }

    // Debounce validation (300ms)
    validationTimeout = setTimeout(() => {
      validateUrl(url);
    }, 300);
  }

  /**
   * Handle paste event
   */
  function handlePaste(event: ClipboardEvent) {
    event.preventDefault();
    const pastedText = event.clipboardData?.getData('text') || '';
    url = pastedText.trim();
    validateUrl(url);
  }

  /**
   * Handle clear button click
   */
  function handleClear() {
    url = '';
    platform = null;
    isValid = false;
    error = null;
    showClearButton = false;
    inputRef?.focus();
    dispatchChange();
  }

  /**
   * Dispatch change event
   */
  function dispatchChange() {
    dispatch('change', {
      url,
      platform,
      valid: isValid,
      error
    });
  }

  /**
   * Auto-focus input on mount
   */
  onMount(() => {
    if (autofocus && inputRef) {
      inputRef.focus();
    }
  });
</script>

<div class="url-input-container">
  <label for="social-url-input" class="url-label">
    Social Media URL
  </label>

  <div class="input-wrapper" class:has-platform={platform} class:has-error={error}>
    <!-- Platform Icon -->
    {#if platform && platformInfo()}
      <div
        class="platform-indicator"
        style="border-color: {platformInfo()?.color}"
        title={platformInfo()?.displayName}
      >
        <span class="platform-icon">{platformInfo()?.icon}</span>
      </div>
    {/if}

    <!-- Input Field -->
    <input
      id="social-url-input"
      bind:this={inputRef}
      type="url"
      value={url}
      {placeholder}
      oninput={handleInput}
      onpaste={handlePaste}
      class="url-input"
      class:has-platform-icon={platform}
      autocomplete="off"
      autocorrect="off"
      autocapitalize="off"
      spellcheck="false"
    />

    <!-- Loading Spinner -->
    {#if isValidating}
      <div class="loading-spinner" aria-label="Validating URL">
        <div class="spinner"></div>
      </div>
    {/if}

    <!-- Valid Checkmark -->
    {#if isValid && !isValidating}
      <div class="valid-indicator" aria-label="Valid URL">
        ✓
      </div>
    {/if}

    <!-- Clear Button -->
    {#if showClearButton && !isValidating}
      <button
        type="button"
        class="clear-button"
        onclick={handleClear}
        aria-label="Clear URL"
      >
        ✕
      </button>
    {/if}
  </div>

  <!-- Validation Message -->
  {#if error}
    <div class="validation-message error">
      {error}
    </div>
  {:else if platform && isValid}
    <div class="validation-message success">
      ✓ {platformInfo()?.displayName} post detected
    </div>
  {/if}
</div>

<style>
  .url-input-container {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .url-label {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-normal);
  }

  .input-wrapper {
    position: relative;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 12px;
    background: var(--background-primary);
    border: 2px solid var(--background-modifier-border);
    border-radius: 8px;
    transition: all 0.2s;
  }

  .input-wrapper:focus-within {
    border-color: var(--interactive-accent);
    box-shadow: 0 0 0 3px var(--interactive-accent-hover);
  }

  .input-wrapper.has-error {
    border-color: var(--text-error);
  }

  .input-wrapper.has-error:focus-within {
    box-shadow: 0 0 0 3px rgba(220, 38, 38, 0.1);
  }

  .platform-indicator {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 6px;
    border: 2px solid;
    background: var(--background-secondary);
    flex-shrink: 0;
    animation: slideIn 0.2s ease-out;
  }

  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateX(-8px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }

  .platform-icon {
    font-size: 18px;
  }

  .url-input {
    flex: 1;
    padding: 12px 0;
    background: transparent;
    border: none;
    font-size: 15px;
    color: var(--text-normal);
    outline: none;
    min-height: 44px; /* iOS touch target */
  }

  .url-input.has-platform-icon {
    padding-left: 0;
  }

  .url-input::placeholder {
    color: var(--text-muted);
  }

  .loading-spinner {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    flex-shrink: 0;
  }

  .spinner {
    width: 16px;
    height: 16px;
    border: 2px solid var(--background-modifier-border);
    border-top-color: var(--interactive-accent);
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .valid-indicator {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    color: #10b981;
    font-size: 20px;
    font-weight: bold;
    flex-shrink: 0;
    animation: pop 0.3s ease-out;
  }

  @keyframes pop {
    0% {
      transform: scale(0);
    }
    50% {
      transform: scale(1.2);
    }
    100% {
      transform: scale(1);
    }
  }

  .clear-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    padding: 0;
    background: transparent;
    border: none;
    border-radius: 4px;
    color: var(--text-muted);
    font-size: 18px;
    cursor: pointer;
    flex-shrink: 0;
    transition: all 0.2s;
  }

  .clear-button:hover {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }

  .clear-button:active {
    transform: scale(0.9);
  }

  .validation-message {
    font-size: 13px;
    line-height: 1.4;
    padding: 0 4px;
  }

  .validation-message.error {
    color: var(--text-error);
  }

  .validation-message.success {
    color: #10b981;
  }

  /* Mobile Responsive */
  @media (max-width: 768px) {
    .url-input {
      font-size: 16px; /* Prevent iOS zoom on focus */
    }
  }

  /* Accessibility - High Contrast Mode */
  @media (prefers-contrast: high) {
    .input-wrapper {
      border-width: 3px;
    }
  }

  /* Reduced Motion */
  @media (prefers-reduced-motion: reduce) {
    .platform-indicator,
    .valid-indicator,
    .spinner {
      animation: none !important;
    }
  }
</style>
