import type { CallToolResult, InputRequiredResult, ServerContext } from '@modelcontextprotocol/server';
import { confirmationFromEnv, confirmTokenParam, requireConfirmationWithFallback } from '@chrischall/mcp-utils';

export { confirmTokenParam };

/** Appended to every gated tool's description. */
export const CONFIRM_NOTE =
  'Asks the user to confirm first: a confirmation prompt where the client supports one; otherwise the first call returns a preview and a confirmToken, and only a repeat call with that token proceeds (see MCP_CONFIRM_MODE).';

export interface ConfirmWriteOptions {
  /** The tool name the token is bound to. */
  tool: string;
  /** `<service>.<verb>` action id. */
  action: string;
  /** Human-readable summary of the write, shown in the preview. */
  label: string;
  method: string;
  path: string;
  /** The primary id acted on, or '' if none. */
  target: string;
  /** Request body exactly as it will be sent. */
  body?: unknown;
  /** Query params exactly as they will be sent; undefined values are dropped. */
  query?: Record<string, unknown>;
  /** A version of the target that rotates on edit (Tempo's `updatedAt`), when it has one. */
  revision?: string;
  /** The phase-2 token from the tool's input. */
  confirmToken: string | undefined;
}

/**
 * Confirm-gate for a mutating tool. A client that can show a confirmation
 * prompt is asked; one that cannot gets the two-phase token flow (governed by
 * `MCP_CONFIRM_MODE`): phase 1 returns a preview of exactly what would be sent
 * plus a `confirmToken`, and only a repeat call with that token proceeds. The
 * token is bound to the method, path, body and query, so a changed argument —
 * or, for an update, a changed current resource — is refused as DRAFT_CHANGED.
 *
 * Returns `undefined` to proceed with the write, otherwise the result to return
 * unchanged.
 */
export function confirmWrite(
  ctx: ServerContext,
  opts: ConfirmWriteOptions,
): Promise<InputRequiredResult | CallToolResult | undefined> {
  // Drop undefined query values so an all-undefined query object doesn't
  // surface a noisy `willSendQuery: {}` in the preview.
  const cleanQuery = opts.query
    ? Object.fromEntries(Object.entries(opts.query).filter(([, v]) => v !== undefined))
    : undefined;
  const hasQuery = cleanQuery !== undefined && Object.keys(cleanQuery).length > 0;
  const preview: Record<string, unknown> = {
    action: opts.label,
    method: opts.method,
    path: opts.path,
    ...(opts.body !== undefined ? { willSend: opts.body } : {}),
    ...(hasQuery ? { willSendQuery: cleanQuery } : {}),
  };
  const payload = {
    method: opts.method,
    path: opts.path,
    body: opts.body,
    query: hasQuery ? cleanQuery : undefined,
  };
  return requireConfirmationWithFallback(
    ctx,
    confirmationFromEnv({
      action: opts.action,
      message: 'Review and confirm this Tempo change:',
      details: preview,
      tool: opts.tool,
      confirmToken: opts.confirmToken,
      subject: () => ({
        target: opts.target,
        ...(opts.revision !== undefined ? { revision: opts.revision } : {}),
        payload,
        preview,
      }),
    }),
  );
}
