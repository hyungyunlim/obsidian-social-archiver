import type { Context } from 'hono';

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error'
}

interface LogContext {
  requestId?: string;
  userId?: string;
  url?: string;
  method?: string;
  ip?: string;
  userAgent?: string;
  [key: string]: unknown;
}

export class Logger {
  private requestId: string;
  private context: LogContext;

  constructor(requestId: string, context: LogContext = {}) {
    this.requestId = requestId;
    this.context = context;
  }

  static fromContext(c: Context): Logger {
    const requestId = c.get('requestId') || generateRequestId();
    
    return new Logger(requestId, {
      url: c.req.url,
      method: c.req.method,
      ip: c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For'),
      userAgent: c.req.header('User-Agent')
    });
  }

  private log(level: LogLevel, message: string, data?: any): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      requestId: this.requestId,
      message,
      ...this.context,
      ...(data && { data })
    };

    // Cloudflare Logpush compatible JSON format
    console.log(JSON.stringify(logEntry));
  }

  debug(message: string, data?: any): void {
    this.log(LogLevel.DEBUG, message, data);
  }

  info(message: string, data?: any): void {
    this.log(LogLevel.INFO, message, data);
  }

  warn(message: string, data?: any): void {
    this.log(LogLevel.WARN, message, data);
  }

  error(message: string, error?: Error | any): void {
    const errorData = error instanceof Error ? {
      name: error.name,
      message: error.message,
      stack: error.stack
    } : error;
    
    this.log(LogLevel.ERROR, message, errorData);
  }

  setContext(key: string, value: unknown): void {
    this.context[key] = value;
  }

  addUserId(userId: string): void {
    this.context.userId = userId;
  }
}

export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}