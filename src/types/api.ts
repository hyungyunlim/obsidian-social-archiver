export interface ApiError {
  code: string;
  message: string;
  retryAfter?: number;
  details?: Record<string, unknown>;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ApiError;
}

export interface ArchiveRequest {
  url: string;
  options: {
    enableAI?: boolean;
    deepResearch?: boolean;
    downloadMedia?: boolean;
  };
  licenseKey?: string;
}

export interface ArchiveResponse {
  jobId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  result?: {
    postData: unknown;
    creditsUsed: number;
  };
  error?: ApiError;
}

export interface JobStatusResponse {
  jobId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress?: number;
  result?: unknown;
  error?: ApiError;
}

export interface LicenseValidationRequest {
  licenseKey: string;
}

export interface LicenseValidationResponse {
  valid: boolean;
  plan: 'free' | 'pro';
  creditsRemaining: number;
  resetDate: string;
  features: string[];
}