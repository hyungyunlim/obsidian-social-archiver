export class BaseError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: any;

  constructor(message: string, code: string, statusCode: number, details?: any) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    
    // Maintains proper stack trace for where our error was thrown
    // Note: captureStackTrace is not available in Workers runtime
    // Stack trace will be generated automatically
  }

  toJSON() {
    return {
      code: this.code,
      message: this.message,
      ...(this.details && { details: this.details })
    };
  }
}

export class ValidationError extends BaseError {
  constructor(message: string = 'Invalid request data', details?: any) {
    super(message, 'VALIDATION_ERROR', 400, details);
  }
}

export class RateLimitError extends BaseError {
  public readonly retryAfter: number;

  constructor(retryAfter: number = 60, message: string = 'Too many requests') {
    super(message, 'RATE_LIMIT_EXCEEDED', 429, { retryAfter });
    this.retryAfter = retryAfter;
  }
}

export class AuthenticationError extends BaseError {
  constructor(message: string = 'Invalid or missing authentication') {
    super(message, 'UNAUTHORIZED', 401);
  }
}

export class AuthorizationError extends BaseError {
  constructor(message: string = 'Insufficient permissions') {
    super(message, 'FORBIDDEN', 403);
  }
}

export class NotFoundError extends BaseError {
  constructor(resource: string = 'Resource', message?: string) {
    super(message || `${resource} not found`, 'NOT_FOUND', 404);
  }
}

export class ExternalAPIError extends BaseError {
  public readonly service: string;

  constructor(service: string, message: string = 'External service error', details?: any) {
    super(message, 'EXTERNAL_API_ERROR', 502, { service, ...details });
    this.service = service;
  }
}

export class InsufficientCreditsError extends BaseError {
  public readonly required: number;
  public readonly available: number;

  constructor(required: number, available: number) {
    super(
      `Insufficient credits. Required: ${required}, Available: ${available}`,
      'INSUFFICIENT_CREDITS',
      402,
      { required, available }
    );
    this.required = required;
    this.available = available;
  }
}

export class QuotaExceededError extends BaseError {
  constructor(resource: string = 'quota', message?: string) {
    super(
      message || `${resource} quota exceeded`,
      'QUOTA_EXCEEDED',
      429
    );
  }
}

export class ServiceUnavailableError extends BaseError {
  constructor(message: string = 'Service temporarily unavailable') {
    super(message, 'SERVICE_UNAVAILABLE', 503);
  }
}