/**
 * Mock Obsidian API for testing
 */

export class Notice {
  constructor(public message: string, public timeout?: number) {
    // Mock Notice - do nothing in tests
  }
}

export interface RequestUrlParam {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  throw?: boolean;
}

export interface RequestUrlResponse {
  status: number;
  headers: Record<string, string>;
  text: string;
  json: any;
  arrayBuffer: ArrayBuffer;
}

export async function requestUrl(params: RequestUrlParam): Promise<RequestUrlResponse> {
  // Mock implementation
  return {
    status: 200,
    headers: {},
    text: JSON.stringify({ success: true }),
    json: { success: true },
    arrayBuffer: new ArrayBuffer(0),
  };
}

// Add other Obsidian API mocks as needed
export class Plugin {
  app: any;
  manifest: any;

  async loadData(): Promise<any> {
    return {};
  }

  async saveData(data: any): Promise<void> {
    // Mock save
  }
}

export class TFile {
  constructor(public path: string) {}
}

export class Vault {
  async create(path: string, content: string): Promise<TFile> {
    return new TFile(path);
  }

  async read(file: TFile): Promise<string> {
    return '';
  }

  async modify(file: TFile, content: string): Promise<void> {
    // Mock modify
  }
}
