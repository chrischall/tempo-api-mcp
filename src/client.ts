import { config as loadDotenv } from 'dotenv';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
loadDotenv({ path: join(__dirname, '..', '.env'), override: false, quiet: true });

const BASE_URL = 'https://api.tempo.io';

export class TempoClient {
  private readonly apiToken: string;

  constructor() {
    const token = process.env.TEMPO_API_TOKEN;
    if (!token) throw new Error('TEMPO_API_TOKEN environment variable is required');
    this.apiToken = token;
  }

  async request<T>(method: string, path: string, body?: unknown, queryParams?: Record<string, unknown>): Promise<T> {
    return this.doRequest<T>(method, path, body, queryParams, false);
  }

  private async doRequest<T>(
    method: string,
    path: string,
    body: unknown,
    queryParams: Record<string, unknown> | undefined,
    isRetry: boolean
  ): Promise<T> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };

    let url = `${BASE_URL}${path}`;
    if (queryParams) {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(queryParams)) {
        if (value === undefined || value === null) continue;
        if (Array.isArray(value)) {
          for (const item of value) {
            params.append(key, String(item));
          }
        } else {
          params.set(key, String(value));
        }
      }
      const qs = params.toString();
      if (qs) url += `?${qs}`;
    }

    const response = await fetch(url, {
      method,
      headers,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });

    if (response.status === 401) {
      throw new Error('TEMPO_API_TOKEN is invalid or expired');
    }

    if (response.status === 429) {
      if (!isRetry) {
        await new Promise<void>((r) => setTimeout(r, 2000));
        return this.doRequest<T>(method, path, body, queryParams, true);
      }
      throw new Error('Rate limited by Tempo API');
    }

    if (response.status === 204) {
      return undefined as unknown as T;
    }

    if (!response.ok) {
      let errorText: string;
      try {
        const errorBody = await response.json() as { message?: string; errors?: unknown[] };
        errorText = errorBody.message ?? JSON.stringify(errorBody);
      } catch {
        errorText = response.statusText;
      }
      throw new Error(`Tempo API error: ${response.status} ${errorText} for ${method} ${path}`);
    }

    return response.json() as Promise<T>;
  }
}
