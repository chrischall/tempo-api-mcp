import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import {
  createApiClient,
  loadDotenvSafely,
  readEnvVar,
  type ApiClient,
} from '@chrischall/mcp-utils';

// Load .env for local dev; silently skip if dotenv is unavailable (e.g. mcpb bundle).
const __dirname = dirname(fileURLToPath(import.meta.url));
await loadDotenvSafely({ path: join(__dirname, '..', '.env'), override: false });

const BASE_URL = 'https://api.tempo.io';

export class TempoClient {
  private readonly apiToken: string | null;
  private readonly configError: Error | null;
  private readonly api: ApiClient;

  /**
   * Defer the config error so the server can still start (and respond to the
   * host's install-time smoke test) when TEMPO_API_TOKEN isn't set yet.
   * Tool calls re-raise the error at request time.
   */
  constructor() {
    const token = readEnvVar('TEMPO_API_TOKEN');
    if (!token) {
      this.apiToken = null;
      this.configError = new Error('TEMPO_API_TOKEN environment variable is required');
    } else {
      this.apiToken = token;
      this.configError = null;
    }
    this.api = createApiClient({
      baseUrl: BASE_URL,
      getToken: () => this.requireToken(),
      serviceName: 'Tempo',
      retry: { count: 1, delayMs: 2000 },
    });
  }

  private requireToken(): string {
    if (this.configError) throw this.configError;
    return this.apiToken!;
  }

  async request<T>(
    method: string,
    path: string,
    body?: unknown,
    queryParams?: Record<string, unknown>
  ): Promise<T> {
    return this.api.fetchJson<T>(method, path, {
      ...(body !== undefined ? { body } : {}),
      ...(queryParams !== undefined ? { query: queryParams } : {}),
    });
  }
}
