<script lang="ts">
  import type { Platform } from '../../types/post';
  import type { UserPlan } from '../../types/credit';

  /**
   * Props
   */
  interface Props {
    expanded?: boolean;
    enableAI?: boolean;
    downloadMedia?: boolean;
    enableFactCheck?: boolean;
    enableSentiment?: boolean;
    platform?: Platform | null;
    userPlan?: UserPlan;
  }

  let {
    expanded = $bindable(false),
    enableAI = $bindable(false),
    downloadMedia = $bindable(true),
    enableFactCheck = $bindable(false),
    enableSentiment = $bindable(false),
    platform = null,
    userPlan = 'free'
  }: Props = $props();

  /**
   * Credit costs
   */
  const creditCosts = {
    basic: 1,
    withAI: 3,
    deepResearch: 5
  };

  /**
   * Computed states
   */
  const isProUser = $derived(userPlan === 'pro');
  const aiOptionsDisabled = $derived(!isProUser);
  const totalCredits = $derived(() => {
    let cost = creditCosts.basic;
    if (enableAI) {
      cost = creditCosts.withAI;
    }
    if (enableFactCheck) {
      cost = creditCosts.deepResearch;
    }
    return cost;
  });

  /**
   * Toggle expanded state
   */
  function toggleExpanded() {
    expanded = !expanded;
  }

  /**
   * Handle AI toggle
   */
  function handleAIToggle() {
    if (!aiOptionsDisabled) {
      enableAI = !enableAI;

      // Disable AI sub-options if AI is disabled
      if (!enableAI) {
        enableFactCheck = false;
        enableSentiment = false;
      }
    }
  }

  /**
   * Handle fact check toggle
   */
  function handleFactCheckToggle() {
    if (!aiOptionsDisabled && enableAI) {
      enableFactCheck = !enableFactCheck;
    }
  }

  /**
   * Handle sentiment toggle
   */
  function handleSentimentToggle() {
    if (!aiOptionsDisabled && enableAI) {
      enableSentiment = !enableSentiment;
    }
  }
</script>

<div class="advanced-options-container">
  <!-- Toggle Header -->
  <button
    type="button"
    class="options-toggle"
    onclick={toggleExpanded}
    aria-expanded={expanded}
    aria-label="Toggle advanced options"
  >
    <span class="toggle-text">Advanced Options</span>
    <div class="toggle-indicators">
      {#if totalCredits() > 1}
        <span class="credit-badge" title="Total credits required">
          {totalCredits()} credits
        </span>
      {/if}
      <span class="chevron" class:expanded>{expanded ? '▼' : '▶'}</span>
    </div>
  </button>

  <!-- Expandable Content -->
  {#if expanded}
    <div class="options-content">
      <!-- Media Handling Section -->
      <div class="option-section">
        <h4 class="section-title">📁 Media Handling</h4>

        <label class="option-item">
          <input
            type="checkbox"
            checked={downloadMedia}
            onchange={() => downloadMedia = !downloadMedia}
            class="option-checkbox"
          />
          <div class="option-info">
            <span class="option-label">Download images & videos</span>
            <span class="option-description">
              Save media files to your vault (recommended)
            </span>
          </div>
        </label>
      </div>

      <!-- AI Features Section -->
      <div class="option-section">
        <div class="section-header">
          <h4 class="section-title">🤖 AI Enhancement</h4>
          {#if !isProUser}
            <span class="pro-badge">Pro Only</span>
          {/if}
        </div>

        <label class="option-item" class:disabled={aiOptionsDisabled}>
          <input
            type="checkbox"
            checked={enableAI}
            onchange={handleAIToggle}
            disabled={aiOptionsDisabled}
            class="option-checkbox"
          />
          <div class="option-info">
            <span class="option-label">Enable AI analysis</span>
            <span class="option-description">
              Add summary, tags, and sentiment analysis (+2 credits)
            </span>
          </div>
        </label>

        <!-- AI Sub-options -->
        {#if enableAI && !aiOptionsDisabled}
          <div class="sub-options">
            <label class="option-item sub-option">
              <input
                type="checkbox"
                checked={enableSentiment}
                onchange={handleSentimentToggle}
                class="option-checkbox"
              />
              <div class="option-info">
                <span class="option-label">Sentiment analysis</span>
                <span class="option-description">
                  Detect emotional tone and sentiment
                </span>
              </div>
            </label>

            <label class="option-item sub-option">
              <input
                type="checkbox"
                checked={enableFactCheck}
                onchange={handleFactCheckToggle}
                class="option-checkbox"
              />
              <div class="option-info">
                <span class="option-label">Fact checking (Deep Research)</span>
                <span class="option-description">
                  Verify claims with online sources (+2 credits = 5 total)
                </span>
              </div>
            </label>
          </div>
        {/if}

        {#if aiOptionsDisabled}
          <div class="upgrade-prompt">
            <p>Upgrade to Pro to unlock AI-powered analysis and deep research features.</p>
            <button
              type="button"
              class="btn-upgrade-small"
              onclick={() => window.open('https://gumroad.com/social-archiver-pro', '_blank')}
            >
              ✨ Upgrade to Pro
            </button>
          </div>
        {/if}
      </div>

      <!-- Platform-specific Info -->
      {#if platform}
        <div class="platform-info">
          <span class="info-icon">ℹ️</span>
          <span class="info-text">
            Archiving from <strong>{platform.charAt(0).toUpperCase() + platform.slice(1)}</strong>
          </span>
        </div>
      {/if}

      <!-- Credit Summary -->
      <div class="credit-summary">
        <div class="summary-row">
          <span class="summary-label">Total credits required:</span>
          <span class="summary-value">{totalCredits()}</span>
        </div>
        {#if enableAI}
          <div class="summary-breakdown">
            <div class="breakdown-item">Base archive: 1</div>
            {#if enableAI && !enableFactCheck}
              <div class="breakdown-item">+ AI analysis: 2</div>
            {/if}
            {#if enableFactCheck}
              <div class="breakdown-item">+ Deep research: 4</div>
            {/if}
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .advanced-options-container {
    display: flex;
    flex-direction: column;
    background: var(--background-secondary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 8px;
    overflow: hidden;
  }

  /* Toggle Header */
  .options-toggle {
    width: 100%;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 14px 16px;
    background: var(--background-secondary);
    border: none;
    cursor: pointer;
    font-size: 15px;
    font-weight: 600;
    color: var(--text-normal);
    transition: background 0.2s;
    min-height: 44px; /* iOS touch target */
  }

  .options-toggle:hover {
    background: var(--background-modifier-hover);
  }

  .toggle-text {
    font-weight: 600;
  }

  .toggle-indicators {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .credit-badge {
    padding: 3px 8px;
    background: var(--interactive-accent);
    color: white;
    border-radius: 10px;
    font-size: 12px;
    font-weight: 600;
  }

  .chevron {
    font-size: 12px;
    color: var(--text-muted);
    transition: transform 0.2s;
  }

  .chevron.expanded {
    transform: rotate(90deg);
  }

  /* Options Content */
  .options-content {
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 20px;
    background: var(--background-primary);
    animation: expandDown 0.3s ease-out;
  }

  @keyframes expandDown {
    from {
      opacity: 0;
      transform: translateY(-8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  /* Option Section */
  .option-section {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .section-header {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .section-title {
    margin: 0;
    font-size: 14px;
    font-weight: 700;
    color: var(--text-normal);
  }

  .pro-badge {
    padding: 2px 8px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border-radius: 8px;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
  }

  /* Option Item */
  .option-item {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 12px;
    background: var(--background-secondary);
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .option-item:hover:not(.disabled) {
    background: var(--background-modifier-hover);
  }

  .option-item.disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .option-item.sub-option {
    margin-left: 24px;
    background: var(--background-primary);
  }

  .option-checkbox {
    width: 20px;
    height: 20px;
    margin-top: 2px;
    cursor: pointer;
    flex-shrink: 0;
  }

  .option-checkbox:disabled {
    cursor: not-allowed;
  }

  .option-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .option-label {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-normal);
  }

  .option-description {
    font-size: 12px;
    color: var(--text-muted);
    line-height: 1.4;
  }

  /* Sub-options */
  .sub-options {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 4px;
  }

  /* Upgrade Prompt */
  .upgrade-prompt {
    padding: 12px;
    background: linear-gradient(135deg, #f0f4ff 0%, #e6ebff 100%);
    border: 1px solid #667eea;
    border-radius: 6px;
    text-align: center;
  }

  .upgrade-prompt p {
    margin: 0 0 10px 0;
    font-size: 13px;
    color: #4c51bf;
    line-height: 1.4;
  }

  .btn-upgrade-small {
    padding: 8px 16px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-upgrade-small:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
  }

  .btn-upgrade-small:active {
    transform: translateY(0);
  }

  /* Platform Info */
  .platform-info {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
    background: var(--background-secondary);
    border-radius: 6px;
    font-size: 13px;
  }

  .info-icon {
    font-size: 16px;
  }

  .info-text {
    color: var(--text-muted);
  }

  .info-text strong {
    color: var(--text-normal);
    font-weight: 600;
  }

  /* Credit Summary */
  .credit-summary {
    padding: 12px;
    background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
    border: 1px solid #f59e0b;
    border-radius: 6px;
  }

  .summary-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 14px;
    font-weight: 700;
    color: #78350f;
  }

  .summary-label {
    color: #78350f;
  }

  .summary-value {
    font-size: 18px;
    color: #92400e;
  }

  .summary-breakdown {
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px solid rgba(120, 53, 15, 0.2);
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .breakdown-item {
    font-size: 12px;
    color: #92400e;
    padding-left: 8px;
  }

  /* Mobile Responsive */
  @media (max-width: 768px) {
    .options-toggle {
      font-size: 14px;
      padding: 12px 14px;
    }

    .options-content {
      padding: 14px;
      gap: 16px;
    }

    .option-item.sub-option {
      margin-left: 16px;
    }
  }

  /* Reduced Motion */
  @media (prefers-reduced-motion: reduce) {
    .options-content {
      animation: none !important;
    }

    .chevron {
      transition: none;
    }
  }
</style>
