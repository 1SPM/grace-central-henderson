/**
 * Base Agent Class
 *
 * Abstract base class for all agents in the Grace CRM system.
 * Provides common functionality for logging, action tracking, and execution.
 */

import type {
  AgentConfig,
  AgentAction,
  AgentLog,
  AgentResult,
  AgentContext,
  AgentActionType,
} from './types';

export abstract class BaseAgent {
  protected config: AgentConfig;
  protected context: AgentContext;
  protected logs: AgentLog[] = [];
  protected actions: AgentAction[] = [];

  constructor(config: AgentConfig, context: AgentContext) {
    this.config = config;
    this.context = context;
  }

  /**
   * Execute the agent's main logic
   */
  abstract execute(): Promise<AgentResult>;

  /**
   * Get agent configuration
   */
  getConfig(): AgentConfig {
    return this.config;
  }

  /**
   * Check if agent is enabled and active
   */
  isActive(): boolean {
    return this.config.enabled && this.config.status === 'active';
  }

  /**
   * Log an info message
   */
  protected log(message: string, metadata?: Record<string, unknown>): void {
    this.logs.push({
      id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      agentId: this.config.id,
      level: 'info',
      message,
      metadata,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Log a warning message
   */
  protected warn(message: string, metadata?: Record<string, unknown>): void {
    this.logs.push({
      id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      agentId: this.config.id,
      level: 'warning',
      message,
      metadata,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Log an error message
   */
  protected error(message: string, metadata?: Record<string, unknown>): void {
    this.logs.push({
      id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      agentId: this.config.id,
      level: 'error',
      message,
      metadata,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Record an action execution
   */
  protected recordAction(
    type: AgentActionType,
    success: boolean,
    options: {
      template?: string;
      templateData?: Record<string, string>;
      targetPersonId?: string;
      metadata?: Record<string, unknown>;
      error?: string;
    } = {}
  ): AgentAction {
    const action: AgentAction = {
      id: `action-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      agentId: this.config.id,
      type,
      template: options.template,
      templateData: options.templateData,
      targetPersonId: options.targetPersonId,
      metadata: options.metadata,
      executedAt: new Date().toISOString(),
      success,
      error: options.error,
    };
    this.actions.push(action);
    return action;
  }

  /**
   * Get execution results
   */
  protected getResults(): AgentResult {
    const successfulActions = this.actions.filter((a) => a.success).length;
    const failedActions = this.actions.filter((a) => !a.success).length;
    const errors = this.logs
      .filter((l) => l.level === 'error')
      .map((l) => l.message);

    return {
      success: failedActions === 0,
      actionsExecuted: successfulActions,
      actionsFailed: failedActions,
      logs: this.logs,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Format a date for display
   */
  protected formatDate(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  /**
   * Check if two dates are on the same day (ignoring year for birthdays)
   */
  protected isSameMonthDay(date1: Date, date2: Date): boolean {
    return (
      date1.getMonth() === date2.getMonth() &&
      date1.getDate() === date2.getDate()
    );
  }

  /**
   * Calculate age/years from a date
   */
  protected calculateYears(fromDate: Date | string): number {
    const from = typeof fromDate === 'string' ? new Date(fromDate) : fromDate;
    const today = this.context.currentDate;
    let years = today.getFullYear() - from.getFullYear();
    const monthDiff = today.getMonth() - from.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < from.getDate())) {
      years--;
    }
    return years;
  }

  /**
   * Generate a unique receipt number
   */
  protected generateReceiptNumber(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).slice(2, 6).toUpperCase();
    return `RCP-${timestamp}-${random}`;
  }
}
