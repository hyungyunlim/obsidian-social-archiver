import type { FactCheckResult } from '@/types/post';

/**
 * FactCheckFormatter - Format AI fact check results for markdown
 * Single Responsibility: Fact check result formatting
 */
export class FactCheckFormatter {
  /**
   * Format fact checks for markdown
   */
  formatFactChecks(factChecks: FactCheckResult[] | undefined): string {
    if (!factChecks || factChecks.length === 0) {
      return '';
    }

    return factChecks
      .map((check: FactCheckResult, index: number) => {
        const icon = {
          true: '✅',
          false: '❌',
          misleading: '⚠️',
          unverifiable: '❓',
        }[check.verdict];

        return `**${index + 1}. ${icon} ${check.claim}**
- Verdict: ${check.verdict}
- Confidence: ${(check.confidence * 100).toFixed(0)}%
- Evidence: ${check.evidence}`;
      })
      .join('\n\n');
  }
}
