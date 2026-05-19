import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

// Load .env for local dev; silently skip if dotenv is unavailable (e.g. mcpb bundle)
try {
  const { config } = await import('dotenv');
  const __dirname = dirname(fileURLToPath(import.meta.url));
  config({ path: join(__dirname, '..', '.env'), override: false, quiet: true });
} catch {
  // not available — rely on process.env (mcpb sets credentials via mcp_config.env)
}

/**
 * Read an env var, trim whitespace, and treat as unset if blank or if the value
 * looks like an unsubstituted shell placeholder (e.g. `${FOO}`) — defends
 * against MCP hosts that pass .mcp.json env blocks through unexpanded.
 */
function readVar(key: string): string | undefined {
  const raw = process.env[key];
  if (typeof raw !== 'string') return undefined;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return undefined;
  if (trimmed === 'undefined' || trimmed === 'null') return undefined;
  if (/^\$\{[^}]*\}$/.test(trimmed)) return undefined;
  return trimmed;
}

const BASE_URL = 'https://api.tempo.io';

export class TempoClient {
  private readonly apiToken: string | null;
  private readonly configError: Error | null;

  /**
   * Defer the config error so the server can still start (and respond to the
   * host's install-time smoke test) when TEMPO_API_TOKEN isn't set yet.
   * Tool calls re-raise the error at request time.
   */
  constructor() {
    const token = readVar('TEMPO_API_TOKEN');
    if (!token) {
      this.apiToken = null;
      this.configError = new Error('TEMPO_API_TOKEN environment variable is required');
    } else {
      this.apiToken = token;
      this.configError = null;
    }
  }

  private requireToken(): string {
    if (this.configError) throw this.configError;
    return this.apiToken!;
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
      Authorization: `Bearer ${this.requireToken()}`,
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