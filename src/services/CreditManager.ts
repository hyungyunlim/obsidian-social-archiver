/**
 * CreditManager - Integrated credit management service
 */

import { Notice } from 'obsidian';
import {
  Platform,
  License,
  CreditTransaction,
  TransactionType,
  CreditReservation,
  CreditAlert,
  CreditThreshold,
  CreditAlertConfig,
  CreditEvent,
  CreditEventType,
  CostEstimate,
} from '../types/credit';
import { IService } from '../types/services';
import { CloudflareAPI } from './CloudflareAPI';
import { CostTracker } from './CostTracker';
import { Logger } from './Logger';

/**
 * Credit manager configuration
 */
export interface CreditManagerConfig {
  /** License key */
  licenseKey?: string;
  /** Alert configuration */
  alerts: CreditAlertConfig;
  /** Reservation timeout in milliseconds */
  reservationTimeout: number;
  /** Whether to auto-refund on failure */
  autoRefund: boolean;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: Partial<CreditManagerConfig> = {
  alerts: {
    enabled: true,
    thresholds: [CreditThreshold.CRITICAL, CreditThreshold.LOW, CreditThreshold.MEDIUM],
    showNotifications: true,
    logToConsole: true,
  },
  reservationTimeout: 300000, // 5 minutes
  autoRefund: true,
};

/**
 * Credit manager service
 */
export class CreditManager implements IService {
  private config: CreditManagerConfig;
  private api: CloudflareAPI;
  private tracker: CostTracker;
  private logger?: Logger;
  private initialized = false;

  // Current license and balance
  private license?: License;
  private balance = 0;

  // Reservations
  private reservations: Map<string, CreditReservation> = new Map();
  private reservationCleanupInterval?: NodeJS.Timeout;

  // Alert tracking
  private alertedThresholds: Set<CreditThreshold> = new Set();

  // Event listeners
  private eventListeners: Map<CreditEventType, Set<(event: CreditEvent) => void>> = new Map();

  constructor(
    config: CreditManagerConfig,
    api: CloudflareAPI,
    tracker: CostTracker,
    logger?: Logger
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config } as CreditManagerConfig;
    this.api = api;
    this.tracker = tracker;
    this.logger = logger;
  }

  /**
   * Initialize the credit manager
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      this.logger?.warn('CreditManager already initialized');
      return;
    }

    this.logger?.info('Initializing CreditManager', {
      hasLicenseKey: !!this.config.licenseKey,
      alertsEnabled: this.config.alerts.enabled,
    });

    // Initialize dependencies
    await this.api.initialize();
    await this.tracker.initialize();

    // Set initialized before loading license
    this.initialized = true;

    // Load license if key is provided
    if (this.config.licenseKey) {
      await this.loadLicense(this.config.licenseKey);
    }

    // Start reservation cleanup
    this.startReservationCleanup();

    this.logger?.info('CreditManager initialized successfully');
  }

  /**
   * Shutdown the credit manager
   */
  async shutdown(): Promise<void> {
    if (!this.initialized) {
      return;
    }

    this.logger?.info('Shutting down CreditManager');

    // Stop reservation cleanup
    if (this.reservationCleanupInterval) {
      clearInterval(this.reservationCleanupInterval);
      this.reservationCleanupInterval = undefined;
    }

    // Shutdown dependencies
    await this.tracker.shutdown();
    await this.api.shutdown();

    // Clear event listeners
    this.eventListeners.clear();

    this.initialized = false;
  }

  /**
   * Load license and refresh balance
   */
  async loadLicense(licenseKey: string): Promise<License> {
    this.ensureInitialized();

    this.logger?.info('Loading license');

    this.api.setLicenseKey(licenseKey);
    this.config.licenseKey = licenseKey;

    const response = await this.api.validateLicense(licenseKey);

    this.license = {
      key: licenseKey,
      plan: response.plan,
      creditsRemaining: response.creditsRemaining,
      creditLimit: response.creditLimit,
      resetDate: response.resetDate,
      features: response.features,
    };

    this.balance = response.creditsRemaining;

    this.logger?.info('License loaded', {
      plan: this.license.plan,
      creditsRemaining: this.balance,
    });

    // Check thresholds
    this.checkThresholds();

    // Emit event
    this.emitEvent({
      type: CreditEventType.BALANCE_UPDATED,
      timestamp: Date.now(),
      data: { balance: this.balance },
    });

    return this.license;
  }

  /**
   * Get current license
   */
  getLicense(): License | undefined {
    return this.license;
  }

  /**
   * Get current credit balance
   */
  getBalance(): number {
    return this.balance;
  }

  /**
   * Refresh balance from server
   */
  async refreshBalance(): Promise<number> {
    this.ensureInitialized();

    if (!this.config.licenseKey) {
      throw new Error('License key not set');
    }

    this.logger?.debug('Refreshing balance');

    const balance = await this.api.getBalance();
    this.balance = balance;

    if (this.license) {
      this.license.creditsRemaining = balance;
    }

    this.checkThresholds();

    this.emitEvent({
      type: CreditEventType.BALANCE_UPDATED,
      timestamp: Date.now(),
      data: { balance: this.balance },
    });

    return balance;
  }

  /**
   * Reserve credits for a request
   */
  reserveCredits(platform: Platform, reference: string): string {
    this.ensureInitialized();

    const cost = this.tracker.getCost(platform);

    if (this.getAvailableBalance() < cost) {
      throw new Error(`Insufficient credits: need ${cost}, have ${this.getAvailableBalance()}`);
    }

    const reservationId = this.generateId();
    const now = Date.now();

    const reservation: CreditReservation = {
      id: reservationId,
      platform,
      amount: cost,
      createdAt: now,
      expiresAt: now + this.config.reservationTimeout,
      reference,
      active: true,
    };

    this.reservations.set(reservationId, reservation);

    this.logger?.debug('Credits reserved', {
      reservationId,
      platform,
      amount: cost,
    });

    this.emitEvent({
      type: CreditEventType.RESERVATION_CREATED,
      timestamp: now,
      data: { reservationId, platform, amount: cost },
    });

    return reservationId;
  }

  /**
   * Commit a reservation and deduct credits
   */
  async commitReservation(
    reservationId: string,
    success: boolean = true
  ): Promise<CreditTransaction> {
    this.ensureInitialized();

    const reservation = this.reservations.get(reservationId);
    if (!reservation || !reservation.active) {
      throw new Error(`Invalid or expired reservation: ${reservationId}`);
    }

    this.logger?.debug('Committing reservation', {
      reservationId,
      success,
    });

    const transaction = await this.deductCredits(
      reservation.platform,
      reservation.amount,
      reservation.reference,
      success
    );

    // Release reservation
    this.releaseReservation(reservationId);

    return transaction;
  }

  /**
   * Release a reservation without committing
   */
  releaseReservation(reservationId: string): void {
    const reservation = this.reservations.get(reservationId);
    if (reservation) {
      reservation.active = false;
      this.reservations.delete(reservationId);

      this.logger?.debug('Reservation released', { reservationId });

      this.emitEvent({
        type: CreditEventType.RESERVATION_RELEASED,
        timestamp: Date.now(),
        data: { reservationId },
      });
    }
  }

  /**
   * Deduct credits for a request
   */
  async deductCredits(
    platform: Platform,
    amount: number,
    reference?: string,
    success: boolean = true
  ): Promise<CreditTransaction> {
    this.ensureInitialized();

    if (!this.config.licenseKey) {
      throw new Error('License key not set');
    }

    const balanceBefore = this.balance;

    this.logger?.debug('Deducting credits', {
      platform,
      amount,
      reference,
      success,
    });

    let transactionSuccess = success;
    let error: string | undefined;

    try {
      // Only deduct from server if request was successful
      if (success) {
        const response = await this.api.useCredits(platform, amount);
        this.balance = response.creditsRemaining;
      }
    } catch (err) {
      transactionSuccess = false;
      error = err instanceof Error ? err.message : String(err);
      this.logger?.error('Credit deduction failed', { error });
    }

    // Record transaction
    const transaction: CreditTransaction = {
      id: this.generateId(),
      type: TransactionType.DEDUCT,
      platform,
      amount,
      timestamp: Date.now(),
      reference,
      success: transactionSuccess,
      error,
      balanceBefore,
      balanceAfter: this.balance,
    };

    this.tracker.recordTransaction(transaction);

    // Check thresholds
    this.checkThresholds();

    // Emit event
    this.emitEvent({
      type: CreditEventType.TRANSACTION_COMPLETED,
      timestamp: transaction.timestamp,
      data: { transaction },
    });

    this.emitEvent({
      type: CreditEventType.BALANCE_UPDATED,
      timestamp: transaction.timestamp,
      data: { balance: this.balance },
    });

    return transaction;
  }

  /**
   * Refund credits for a failed request
   */
  async refundCredits(
    transactionId: string,
    reason?: string
  ): Promise<CreditTransaction> {
    this.ensureInitialized();

    if (!this.config.licenseKey) {
      throw new Error('License key not set');
    }

    const originalTransaction = this.tracker.getTransaction(transactionId);
    if (!originalTransaction) {
      throw new Error(`Transaction not found: ${transactionId}`);
    }

    if (originalTransaction.type !== TransactionType.DEDUCT) {
      throw new Error(`Cannot refund non-deduct transaction: ${transactionId}`);
    }

    const balanceBefore = this.balance;

    this.logger?.info('Refunding credits', {
      transactionId,
      amount: originalTransaction.amount,
      reason,
    });

    let success = true;
    let error: string | undefined;

    try {
      const response = await this.api.refundCredits(
        originalTransaction.platform,
        originalTransaction.amount,
        transactionId
      );
      this.balance = response.creditsRemaining;
    } catch (err) {
      success = false;
      error = err instanceof Error ? err.message : String(err);
      this.logger?.error('Credit refund failed', { error });
    }

    // Record refund transaction
    const transaction: CreditTransaction = {
      id: this.generateId(),
      type: TransactionType.REFUND,
      platform: originalTransaction.platform,
      amount: originalTransaction.amount,
      timestamp: Date.now(),
      reference: transactionId,
      success,
      error,
      balanceBefore,
      balanceAfter: this.balance,
    };

    this.tracker.recordTransaction(transaction);

    // Emit event
    this.emitEvent({
      type: CreditEventType.REFUND_PROCESSED,
      timestamp: transaction.timestamp,
      data: { transaction, originalTransactionId: transactionId },
    });

    this.emitEvent({
      type: CreditEventType.BALANCE_UPDATED,
      timestamp: transaction.timestamp,
      data: { balance: this.balance },
    });

    return transaction;
  }

  /**
   * Estimate cost for batch operations
   */
  estimateCost(platforms: Platform[]): CostEstimate {
    this.ensureInitialized();

    const estimate = this.tracker.estimateCost(platforms);
    estimate.affordable = this.balance >= estimate.totalCredits;

    if (!estimate.affordable) {
      estimate.creditsNeeded = estimate.totalCredits - this.balance;
    }

    return estimate;
  }

  /**
   * Get available balance (excluding reserved credits)
   */
  getAvailableBalance(): number {
    let reserved = 0;
    this.reservations.forEach((reservation) => {
      if (reservation.active) {
        reserved += reservation.amount;
      }
    });
    return this.balance - reserved;
  }

  /**
   * Check if sufficient credits are available
   */
  hasCredits(amount: number): boolean {
    return this.getAvailableBalance() >= amount;
  }

  /**
   * Add event listener
   */
  on(eventType: CreditEventType, listener: (event: CreditEvent) => void): void {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, new Set());
    }
    this.eventListeners.get(eventType)!.add(listener);
  }

  /**
   * Remove event listener
   */
  off(eventType: CreditEventType, listener: (event: CreditEvent) => void): void {
    const listeners = this.eventListeners.get(eventType);
    if (listeners) {
      listeners.delete(listener);
    }
  }

  // Private helper methods

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('CreditManager not initialized. Call initialize() first.');
    }
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private checkThresholds(): void {
    if (!this.config.alerts.enabled || !this.license) {
      return;
    }

    const percentage = (this.balance / this.license.creditLimit) * 100;

    for (const threshold of this.config.alerts.thresholds) {
      if (percentage <= threshold && !this.alertedThresholds.has(threshold)) {
        this.triggerAlert(threshold, percentage);
        this.alertedThresholds.add(threshold);
      } else if (percentage > threshold && this.alertedThresholds.has(threshold)) {
        // Reset alert if balance increased above threshold
        this.alertedThresholds.delete(threshold);
      }
    }
  }

  private triggerAlert(threshold: CreditThreshold, percentageRemaining: number): void {
    const alert: CreditAlert = {
      threshold,
      creditsRemaining: this.balance,
      creditLimit: this.license!.creditLimit,
      percentageRemaining,
      timestamp: Date.now(),
      message: this.getAlertMessage(threshold, this.balance),
    };

    this.logger?.warn('Credit threshold alert', {
      threshold,
      creditsRemaining: this.balance,
      percentageRemaining,
    });

    if (this.config.alerts.showNotifications) {
      new Notice(alert.message, 10000);
    }

    this.emitEvent({
      type: CreditEventType.ALERT_TRIGGERED,
      timestamp: alert.timestamp,
      data: { alert },
    });
  }

  private getAlertMessage(threshold: CreditThreshold, balance: number): string {
    switch (threshold) {
      case CreditThreshold.CRITICAL:
        return `⚠️ No credits remaining! You have ${balance} credits left.`;
      case CreditThreshold.LOW:
        return `⚠️ Low credits warning! You have ${balance} credits left (10% remaining).`;
      case CreditThreshold.MEDIUM:
        return `💡 Credits running low. You have ${balance} credits left (20% remaining).`;
      default:
        return `Credit alert: ${balance} credits remaining.`;
    }
  }

  private startReservationCleanup(): void {
    this.reservationCleanupInterval = setInterval(() => {
      this.cleanupExpiredReservations();
    }, 60000); // Clean up every minute
  }

  private cleanupExpiredReservations(): void {
    const now = Date.now();
    let cleaned = 0;

    this.reservations.forEach((reservation, id) => {
      if (now > reservation.expiresAt && reservation.active) {
        reservation.active = false;
        this.reservations.delete(id);
        cleaned++;

        this.logger?.debug('Reservation expired and cleaned', { reservationId: id });

        this.emitEvent({
          type: CreditEventType.RESERVATION_RELEASED,
          timestamp: now,
          data: { reservationId: id, reason: 'expired' },
        });
      }
    });

    if (cleaned > 0) {
      this.logger?.debug(`Cleaned up ${cleaned} expired reservations`);
    }
  }

  private emitEvent(event: CreditEvent): void {
    const listeners = this.eventListeners.get(event.type);
    if (listeners) {
      listeners.forEach((listener) => {
        try {
          listener(event);
        } catch (error) {
          this.logger?.error('Event listener error', { eventType: event.type, error });
        }
      });
    }
  }
}
