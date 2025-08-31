import type { Logger } from '@/utils/logger';

export interface Variables {
  requestId?: string;
  logger?: Logger;
  [key: string]: any;
}