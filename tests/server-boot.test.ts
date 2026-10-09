import { describe, expect, it } from 'vitest';
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const binEntry = join(root, 'dist', 'index.js');

interface McpJson {
  mcpServers: Record<string, { command: string; args: string[] }>;
}

function readProjectMcpJson(): McpJson {
  return JSON.parse(readFileSync(join(root, '.mcp.json'), 'utf8')) as McpJson;
}

/** Drive the stdio handshake against a built entrypoint and return its tools. */
async function handshake(command: string, args: string[], cwd: string): Promise<string[]> {
  const env = { ...process.env };
  // No credential: the server must still boot and answer tools/list (the token
  // error is deferred to the first tool call).
  delete env.TEMPO_API_TOKEN;
  const child = spawn(command, args, { cwd, stdio: ['pipe', 'pipe', 'pipe'], env });

  const out: string[] = [];
  const err: string[] = [];
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', (d: string) => out.push(d));
  child.stderr.on('data', (d: string) => err.push(d));

  for (const msg of [
    {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '1' } },
    },
    { jsonrpc: '2.0', method: 'notifications/initialized' },
    { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} },
  ]) {
    child.stdin.write(`${JSON.stringify(msg)}\n`);
  }

  return new Promise<string[]>((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`timed out; stderr: ${err.join('').slice(0, 400)}`));
    }, 30_000);
    let done = false;
    const tryParse = () => {
      for (const line of out.join('').split('\n')) {
        if (!line.trim()) continue;
        try {
          const m = JSON.parse(line) as { id?: number; result?: { tools?: { name: string }[] } };
          if (m.id === 2 && m.result?.tools) {
            done = true;
            clearTimeout(timer);
            child.kill('SIGTERM');
            resolve(m.result.tools.map((t) => t.name).sort());
            return;
          }
        } catch {
          /* partial line; wait for more */
        }
      }
    };
    child.stdout.on('data', tryParse);
    child.on('exit', () => {
      if (done) return;
      clearTimeout(timer);
      reject(new Error(`exited early; stderr: ${err.join('').slice(0, 400)}`));
    });
  });
}

describe('project-scoped .mcp.json', () => {
  it('does not reference CLAUDE_PLUGIN_ROOT', () => {
    // The plugin's MCP server is defined INLINE in .claude-plugin/plugin.json
    // (`npx tempo-api-mcp`). The repo-root .mcp.json is only read for a
    // project-scoped launch (Claude Code opened in this repo), where Claude
    // Code does NOT define CLAUDE_PLUGIN_ROOT — `${CLAUDE_PLUGIN_ROOT}/dist/...`
    // collapses to `/dist/...` and the server dies at startup (regressed in #205).
    expect(JSON.stringify(readProjectMcpJson())).not.toContain('CLAUDE_PLUGIN_ROOT');
  });

  it.runIf(existsSync(binEntry))(
    'boots from the repo .mcp.json the way a project-scoped config does',
    async () => {
      const server = readProjectMcpJson().mcpServers['tempo-api'];
      expect(server).toBeDefined();
      // Launch exactly what the config says, from the repo root, as Claude Code
      // does for a project-scoped server. `node` resolves to the test's node.
      const command = server.command === 'node' ? process.execPath : server.command;
      const entry = server.args[server.args.length - 1];
      expect(existsSync(join(root, entry))).toBe(true);
      const tools = await handshake(command, server.args, root);
      expect(tools).toContain('tempo_healthcheck');
    },
    60_000,
  );
});
