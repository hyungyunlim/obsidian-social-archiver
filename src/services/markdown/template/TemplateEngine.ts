/**
 * Template variable pattern: {{variable}} or {{object.property}}
 */
const TEMPLATE_VAR_PATTERN = /\{\{([^}]+)\}\}/g;

/**
 * Conditional block pattern: {{#if condition}}...{{/if}}
 */
const CONDITIONAL_PATTERN = /\{\{#if\s+([^}]+)\}\}([\s\S]*?)\{\{\/if\}\}/g;

/**
 * TemplateEngine - Variable substitution and conditional rendering
 * Single Responsibility: Template processing with variable interpolation and conditionals
 */
export class TemplateEngine {
  /**
   * Process template with data
   */
  static process(template: string, data: Record<string, any>): string {
    let result = template;

    // Process conditional blocks first
    result = this.processConditionals(result, data);

    // Process variable substitution
    result = this.processVariables(result, data);

    return result;
  }

  /**
   * Process conditional blocks
   */
  private static processConditionals(template: string, data: Record<string, any>): string {
    return template.replace(CONDITIONAL_PATTERN, (_match, condition, content) => {
      const value = this.resolveValue(condition.trim(), data);

      // Truthy check
      if (value && (Array.isArray(value) ? value.length > 0 : true)) {
        return content;
      }

      return '';
    });
  }

  /**
   * Process variable substitution
   */
  private static processVariables(template: string, data: Record<string, any>): string {
    return template.replace(TEMPLATE_VAR_PATTERN, (_match, path) => {
      const value = this.resolveValue(path.trim(), data);
      return this.formatValue(value);
    });
  }

  /**
   * Resolve nested property path
   */
  private static resolveValue(path: string, data: Record<string, any>): any {
    const keys = path.split('.');
    let value: any = data;

    for (const key of keys) {
      if (value === null || value === undefined) {
        return '';
      }
      value = value[key];
    }

    return value;
  }

  /**
   * Format value for output
   */
  private static formatValue(value: any): string {
    if (value === null || value === undefined) {
      return '';
    }

    if (value instanceof Date) {
      return value.toISOString();
    }

    if (Array.isArray(value)) {
      // Format arrays as markdown list (one item per line)
      return value.map(item => `- ${String(item)}`).join('\n');
    }

    if (typeof value === 'object') {
      return JSON.stringify(value, null, 2);
    }

    return String(value);
  }
}
