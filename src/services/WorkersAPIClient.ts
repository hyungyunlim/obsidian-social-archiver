/**
 * Workers API Client
 *
 * Client for communicating with Cloudflare Workers backend
 *
 * Single Responsibility: Workers API HTTP communication
 */

import { requestUrl, RequestUrlParam } from 'obsidian';
import type { IService } from './base/IService';

export interface WorkersAPIConfig {
  endpoint: string;
  licenseKey?: string;
  timeout?: number;
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
  estimatedTime?: number;
  creditsRequired: number;
}

export interface JobStatusResponse {
  jobId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress?: number;
  result?: ArchiveResult;
  error?: string;
  createdAt: number;
  updatedAt: number;
}

export interface ArchiveResult {
  postData: any;
  creditsUsed: number;
  processingTime: number;
  cached: boolean;
}

export interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

/**
 * Workers API Client
 */
export class WorkersAPIClient implements IService {
  private config: WorkersAPIConfig;
  private initialized = false;

  constructor(config: WorkersAPIConfig) {
    this.config = {
      timeout: 30000,
      ...config,
    };
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Validate endpoint
    try {
      new URL(this.config.endpoint);
    } catch {
      throw new Error(`Invalid Workers API endpoint: ${this.config.endpoint}`);
    }

    this.initialized = true;
  }

  async dispose(): Promise<void> {
    this.initialized = false;
  }

  /**
   * Submit archive request
   */
  async submitArchive(request: ArchiveRequest): Promise<ArchiveResponse> {
    console.log('[WorkersAPIClient] submitArchive called', request);
    this.ensureInitialized();

    console.log('[WorkersAPIClient] Making POST request to /api/archive');
    const response = await this.request<ArchiveResponse>('/api/archive', {
      method: 'POST',
      body: JSON.stringify({
        url: request.url,
        options: request.options,
        licenseKey: request.licenseKey || this.config.licenseKey,
      }),
    });

    console.log('[WorkersAPIClient] POST response received', response);
    return response;
  }

  /**
   * Get job status
   */
  async getJobStatus(jobId: string): Promise<JobStatusResponse> {
    this.ensureInitialized();

    const response = await this.request<JobStatusResponse>(`/api/archive/${jobId}`, {
      method: 'GET',
    });

    return response;
  }

  /**
   * Poll job until completed
   */
  async waitForJob(
    jobId: string,
    options: {
      timeout?: number;
      pollInterval?: number;
      onProgress?: (status: JobStatusResponse) => void;
    } = {}
  ): Promise<ArchiveResult> {
    const timeout = options.timeout || 120000; // 2 minutes default
    const pollInterval = options.pollInterval || 2000; // 2 seconds default
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const status = await this.getJobStatus(jobId);

      // Notify progress
      if (options.onProgress) {
        options.onProgress(status);
      }

      // Check if completed
      if (status.status === 'completed') {
        if (!status.result) {
          throw new Error('Job completed but no result available');
        }
        return status.result;
      }

      // Check if failed
      if (status.status === 'failed') {
        throw new Error(`Archive failed: ${status.error || 'Unknown error'}`);
      }

      // Wait before next poll
      await this.delay(pollInterval);
    }

    throw new Error('Archive job timeout');
  }

  /**
   * Validate license
   */
  async validateLicense(licenseKey: string): Promise<any> {
    this.ensureInitialized();

    const response = await this.request('/api/license/validate', {
      method: 'POST',
      body: JSON.stringify({ licenseKey }),
    });

    return response;
  }

  /**
   * Update license key
   */
  setLicenseKey(licenseKey: string): void {
    this.config.licenseKey = licenseKey;
  }

  /**
   * Make HTTP request
   */
  private async request<T>(
    path: string,
    options: Partial<RequestUrlParam> = {}
  ): Promise<T> {
    const url = `${this.config.endpoint}${path}`;

    console.log('[WorkersAPIClient] request starting', {
      url,
      method: options.method || 'GET',
      hasBody: !!options.body
    });

    try {
      const response = await requestUrl({
        url,
        method: options.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        body: options.body,
        throw: false,
      });

      console.log('[WorkersAPIClient] HTTP response received', {
        status: response.status,
        statusText: response.text
      });

      // Parse response
      const data: APIResponse<T> = response.json;

      console.log('[WorkersAPIClient] Response parsed', { success: data.success });

      // Handle errors
      if (!data.success) {
        console.error('[WorkersAPIClient] API returned error', data.error);
        const error = new Error(data.error?.message || 'Unknown API error');
        (error as any).code = data.error?.code;
        (error as any).details = data.error?.details;
        (error as any).status = response.status;
        throw error;
      }

      console.log('[WorkersAPIClient] Request successful');
      return data.data as T;

    } catch (error) {
      console.error('[WorkersAPIClient] Request failed:', {
        url,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      throw error;
    }
  }

  /**
   * Ensure initialized
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('WorkersAPIClient not initialized. Call initialize() first.');
    }
  }

  /**
   * Delay utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
