import { vi } from 'vitest';
import type { CallToolResult } from '@modelcontextprotocol/server';

/**
 * A ServerContext for a caller that declares no elicitation capability — i.e.
 * a client that cannot be prompted, which (under the default
 * MCP_CONFIRM_MODE=ask-user) gets the two-phase confirm-token flow.
 */
export const NO_ELICIT_CTX = {
  mcpReq: { envelope: { 'io.modelcontextprotocol/clientCapabilities': {} } },
};

type Cb = (args: Record<string, unknown>, ctx: unknown) => Promise<CallToolResult>;

/** Phase 1 only: the preview a gated tool returns without writing. */
export async function callPreview(tool: { cb: Function }, args: Record<string, unknown>) {
  const result = await (tool.cb as Cb)(args, NO_ELICIT_CTX);
  const parsed = JSON.parse((result.content[0] as { text: string }).text);
  if (parsed.status !== 'confirmation-required') throw new Error(`expected a confirmation preview, got ${JSON.stringify(parsed)}`);
  return parsed as { status: string; confirmToken: string; preview: Record<string, any> };
}

/**
 * Drive a gated tool through both phases — preview, then the repeat call with
 * its confirmToken — and return the phase-2 result. Mock call history is
 * cleared between the phases (implementations are kept), so assertions see
 * only what the confirmed call did.
 */
export async function callConfirmed(tool: { cb: Function }, args: Record<string, unknown>): Promise<CallToolResult & { content: any[] }> {
  const { confirmToken } = await callPreview(tool, args);
  vi.clearAllMocks();
  return (tool.cb as Cb)({ ...args, confirmToken }, NO_ELICIT_CTX) as Promise<CallToolResult & { content: any[] }>;
}
