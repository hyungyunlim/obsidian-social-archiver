export { ArchiveService } from './ArchiveService';
export { MarkdownConverter } from './MarkdownConverter';
export { MediaHandler } from './MediaHandler';
export { VaultManager } from './VaultManager';
export { ApiClient } from './ApiClient';
export { ArchiveOrchestrator } from './ArchiveOrchestrator';
export { ErrorHandler } from './ErrorHandler';
export { PlatformDetector } from './PlatformDetector';
export { URLExpander } from './URLExpander';
export { LinkPreviewExtractor } from './LinkPreviewExtractor';
export { GumroadClient } from './GumroadClient';
export { LicenseValidator } from './LicenseValidator';
export { LicenseStorage } from './LicenseStorage';
export { CreditManager } from './CreditManager';
export { CreditResetScheduler } from './CreditResetScheduler';
export { GumroadWebhookHandler } from './GumroadWebhookHandler';
export { PromoCodeValidator } from './licensing/PromoCodeValidator';
export { PromoCodeStorage } from './licensing/PromoCodeStorage';
export { LicenseExpirationNotifier } from './licensing/LicenseExpirationNotifier';
export { GracePeriodManager } from './licensing/GracePeriodManager';

// Export types
export type {
  OrchestratorConfig,
  OrchestratorOptions,
  OrchestratorEvent,
  EventListener,
} from './ArchiveOrchestrator';

export type {
  ArchiveServiceConfig,
} from './ArchiveService';

export type {
  VaultManagerConfig,
  SaveResult,
} from './VaultManager';

export type {
  MediaHandlerConfig,
  MediaResult,
  DownloadProgressCallback,
} from './MediaHandler';

export type {
  MarkdownResult,
} from './MarkdownConverter';

export type {
  HttpClientConfig,
} from './ApiClient';

export type {
  ErrorHandlerConfig,
  ErrorLogEntry,
  ErrorStats,
  RecoveryStrategy,
} from './ErrorHandler';

export type {
  PlatformDetectionResult,
} from './PlatformDetector';

export type {
  ExpansionResult,
  ExpansionOptions,
} from './URLExpander';

export type {
  ExtractionOptions,
  ExtractionResult,
} from './LinkPreviewExtractor';

// LinkPreview is defined in types/post.ts
export type { LinkPreview } from '../types/post';

export type {
  GumroadClientConfig,
} from './GumroadClient';

export type {
  LicenseValidatorConfig,
} from './LicenseValidator';

export type {
  LicenseStorageConfig,
} from './LicenseStorage';

export type {
  CreditManagerConfig,
} from './CreditManager';

export type {
  CreditResetSchedulerConfig,
} from './CreditResetScheduler';

export type {
  GumroadWebhookHandlerConfig,
} from './GumroadWebhookHandler';

export type {
  PromoCodeValidatorConfig,
} from './licensing/PromoCodeValidator';

export type {
  LicenseExpirationNotifierConfig,
  NotificationThreshold,
} from './licensing/LicenseExpirationNotifier';

export type {
  GracePeriodManagerConfig,
  GracePeriodStatus,
  FeatureRestrictions,
} from './licensing/GracePeriodManager';