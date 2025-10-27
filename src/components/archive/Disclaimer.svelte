<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  /**
   * Props
   */
  interface Props {
    showLearnMore?: boolean;
    termsUrl?: string;
  }

  let {
    showLearnMore = true,
    termsUrl = 'https://github.com/yourusername/obsidian-social-archiver#legal'
  }: Props = $props();

  /**
   * Component state
   */
  let accepted = $state(false);
  let dontShowAgain = $state(false);
  let expanded = $state(false);

  /**
   * Event dispatcher
   */
  const dispatch = createEventDispatcher<{
    change: {
      accepted: boolean;
      dontShow: boolean;
    };
  }>();

  /**
   * Handle checkbox changes
   */
  function handleAcceptChange() {
    accepted = !accepted;
    dispatchChange();
  }

  function handleDontShowChange() {
    dontShowAgain = !dontShowAgain;
    dispatchChange();
  }

  /**
   * Toggle expanded state
   */
  function toggleExpanded() {
    expanded = !expanded;
  }

  /**
   * Dispatch change event
   */
  function dispatchChange() {
    dispatch('change', {
      accepted,
      dontShow: dontShowAgain
    });
  }

  /**
   * Open terms in external browser
   */
  function openTerms() {
    window.open(termsUrl, '_blank');
  }
</script>

<div class="disclaimer-container">
  <!-- Warning Header -->
  <div class="disclaimer-header">
    <div class="warning-icon" aria-label="Warning">⚠️</div>
    <div class="disclaimer-title">Important Legal Notice</div>
  </div>

  <!-- Main Message -->
  <div class="disclaimer-content">
    <p class="disclaimer-text">
      <strong>Archive only content you have permission to save.</strong>
    </p>
    <p class="disclaimer-subtext">
      You are responsible for ensuring you have the right to archive and store social media content.
      Unauthorized archiving may violate copyright laws and platform terms of service.
    </p>

    <!-- Expandable Learn More Section -->
    {#if showLearnMore}
      <button
        type="button"
        class="learn-more-toggle"
        onclick={toggleExpanded}
        aria-expanded={expanded}
      >
        <span>Learn More</span>
        <span class="chevron" class:expanded>{expanded ? '▼' : '▶'}</span>
      </button>

      {#if expanded}
        <div class="learn-more-content">
          <h4>Best Practices:</h4>
          <ul>
            <li>Only archive your own content or content you have explicit permission to save</li>
            <li>Respect copyright and intellectual property rights</li>
            <li>Be aware of platform-specific terms of service</li>
            <li>Consider privacy implications when archiving public content</li>
            <li>Do not use archived content for commercial purposes without permission</li>
          </ul>

          <h4>Recommended Use Cases:</h4>
          <ul>
            <li>Archiving your own social media posts for backup</li>
            <li>Saving educational or reference content for personal use</li>
            <li>Preserving important announcements or public statements</li>
            <li>Research and journalism (with proper attribution)</li>
          </ul>

          <button
            type="button"
            class="btn-terms"
            onclick={openTerms}
          >
            Read Full Terms & Conditions
          </button>
        </div>
      {/if}
    {/if}
  </div>

  <!-- Acceptance Checkbox -->
  <div class="disclaimer-actions">
    <label class="checkbox-label" class:disabled={!accepted}>
      <input
        type="checkbox"
        checked={accepted}
        onchange={handleAcceptChange}
        class="disclaimer-checkbox"
      />
      <span class="checkbox-text">
        I understand and accept responsibility for archiving this content
      </span>
    </label>

    <!-- Don't Show Again -->
    <label class="checkbox-label secondary">
      <input
        type="checkbox"
        checked={dontShowAgain}
        onchange={handleDontShowChange}
        class="disclaimer-checkbox"
      />
      <span class="checkbox-text">
        Don't show this disclaimer again
      </span>
    </label>
  </div>
</div>

<style>
  .disclaimer-container {
    padding: 16px;
    background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
    border: 2px solid #f59e0b;
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  /* Header */
  .disclaimer-header {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .warning-icon {
    font-size: 28px;
    flex-shrink: 0;
    animation: pulse 2s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% {
      opacity: 1;
    }
    50% {
      opacity: 0.7;
    }
  }

  .disclaimer-title {
    font-size: 16px;
    font-weight: 700;
    color: #78350f;
  }

  /* Content */
  .disclaimer-content {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .disclaimer-text {
    margin: 0;
    font-size: 14px;
    color: #78350f;
    line-height: 1.5;
  }

  .disclaimer-text strong {
    font-weight: 700;
  }

  .disclaimer-subtext {
    margin: 0;
    font-size: 13px;
    color: #92400e;
    line-height: 1.5;
  }

  /* Learn More Toggle */
  .learn-more-toggle {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 0;
    background: transparent;
    border: none;
    font-size: 13px;
    font-weight: 600;
    color: #78350f;
    cursor: pointer;
    transition: all 0.2s;
    align-self: flex-start;
  }

  .learn-more-toggle:hover {
    color: #92400e;
  }

  .chevron {
    font-size: 10px;
    transition: transform 0.2s;
  }

  .chevron.expanded {
    transform: rotate(90deg);
  }

  /* Learn More Content */
  .learn-more-content {
    padding: 12px;
    background: rgba(255, 255, 255, 0.6);
    border-radius: 6px;
    font-size: 13px;
    color: #78350f;
    line-height: 1.6;
    animation: expandDown 0.3s ease-out;
  }

  @keyframes expandDown {
    from {
      opacity: 0;
      max-height: 0;
    }
    to {
      opacity: 1;
      max-height: 500px;
    }
  }

  .learn-more-content h4 {
    margin: 12px 0 6px 0;
    font-size: 14px;
    font-weight: 700;
    color: #78350f;
  }

  .learn-more-content h4:first-child {
    margin-top: 0;
  }

  .learn-more-content ul {
    margin: 6px 0;
    padding-left: 20px;
  }

  .learn-more-content li {
    margin: 4px 0;
  }

  .btn-terms {
    margin-top: 12px;
    padding: 8px 16px;
    background: #f59e0b;
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-terms:hover {
    background: #d97706;
    transform: translateY(-1px);
  }

  .btn-terms:active {
    transform: translateY(0);
  }

  /* Actions */
  .disclaimer-actions {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding-top: 8px;
    border-top: 1px solid rgba(120, 53, 15, 0.2);
  }

  .checkbox-label {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    cursor: pointer;
    transition: opacity 0.2s;
  }

  .checkbox-label.disabled {
    opacity: 0.6;
  }

  .checkbox-label.secondary {
    font-size: 13px;
  }

  .disclaimer-checkbox {
    width: 20px;
    height: 20px;
    margin-top: 2px;
    cursor: pointer;
    flex-shrink: 0;
  }

  .checkbox-text {
    flex: 1;
    font-size: 14px;
    font-weight: 600;
    color: #78350f;
    line-height: 1.4;
  }

  .checkbox-label.secondary .checkbox-text {
    font-weight: 500;
    color: #92400e;
  }

  /* Mobile Responsive */
  @media (max-width: 768px) {
    .disclaimer-container {
      padding: 14px;
    }

    .disclaimer-title {
      font-size: 15px;
    }

    .disclaimer-text {
      font-size: 13px;
    }

    .disclaimer-subtext {
      font-size: 12px;
    }
  }

  /* Accessibility - High Contrast */
  @media (prefers-contrast: high) {
    .disclaimer-container {
      border-width: 3px;
    }
  }

  /* Reduced Motion */
  @media (prefers-reduced-motion: reduce) {
    .warning-icon,
    .learn-more-content {
      animation: none !important;
    }

    .chevron {
      transition: none;
    }
  }
</style>
