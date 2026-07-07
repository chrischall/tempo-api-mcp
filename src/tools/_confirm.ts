import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { schemaConfirm, textResult } from '@chrischall/mcp-utils';

export { schemaConfirm };

/**
 * Confirm-gate for a mutating tool (the fleet convention). When `confirm` is not
 * `true`, returns a no-network dry-run preview of exactly what would be sent;
 * when it is `true`, returns `null` so the caller proceeds with the write.
 */
export function previewUnlessConfirmed(
  confirm: boolean | undefined,
  action: string,
  method: string,
  path: string,
  body?: unknown,
  query?: Record<string, unknown>,
): CallToolResult | null {
  if (confirm === true) return null;
  // Drop undefined query values so an all-undefined query object doesn't
  // surface a noisy `willSendQuery: {}` in the preview.
  const cleanQuery = query
    ? Object.fromEntries(Object.entries(query).filter(([, v]) => v !== undefined))
    : undefined;
  return textResult({
    dryRun: true,
    action,
    method,
    path,
    ...(body !== undefined ? { willSend: body } : {}),
    ...(cleanQuery && Object.keys(cleanQuery).length > 0 ? { willSendQuery: cleanQuery } : {}),
    note: 'Re-run with confirm: true to execute.',
  });
}
