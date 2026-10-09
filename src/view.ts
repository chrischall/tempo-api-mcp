import {
  minifiedResult,
  resolveView,
  stripMediaUrls,
  UNTRUSTED_CONTENT_RULE,
  untrustedEnvelope,
  viewParam,
  type View,
} from '@chrischall/mcp-utils';

/**
 * The rungs this server honours (`@chrischall/mcp-utils`' `view` vocabulary;
 * `chrischall/workflows` `docs/fleet-conventions.md`, "Response shape").
 *
 * **What compact does here, and what it deliberately does NOT do.**
 *
 * The read tools in this server hand back Tempo's payload close to
 * verbatim, and the repo holds no verified record of what those payloads
 * contain — no captured fixture, no documented field list. So nothing here can
 * honestly say which of Tempo's fields matter and which are noise.
 *
 * Compact therefore does the one projection that needs no such knowledge: it
 * strips image and avatar URLs. That is SUBTRACTIVE, so it cannot lose a field
 * nobody knew about — the failure an invented field list would risk, where a
 * record comes back with holes in it and reads like a verified answer.
 *
 * When a real payload can be captured, a field projection belongs here beside
 * this one and will save considerably more. Until then this is the honest
 * ceiling, and this docblock says so rather than implying a shape was checked.
 */
export const TEMPO_VIEWS = ['compact', 'full'] as const;

const NOTE =
  'compact strips image/avatar URLs from the response; "full" returns Tempo\'s payload untouched. ' +
  'No field projection: this server has no verified record of which Tempo fields matter, and inventing ' +
  'one would risk dropping a field a caller needs.';

/** The `view` parameter every read tool in this server takes. */
export const viewArg = (): ReturnType<typeof viewParam> => viewParam(TEMPO_VIEWS, { note: NOTE });

/**
 * Answer in the requested rung.
 *
 * Only ever called from a READ tool. A write's response is a receipt — an id,
 * a status — with nothing to strip and everything to keep.
 */
export function viewResponse(view: string | undefined, data: unknown): ReturnType<typeof minifiedResult> {
  return minifiedResult(project(view, data));
}

function project(view: string | undefined, data: unknown): unknown {
  const rung: View = resolveView(view, TEMPO_VIEWS);
  return rung === 'compact' ? stripMediaUrls(data) : data;
}

/** Who writes the free text {@link untrustedViewResponse} fences. */
const TEMPO_UNTRUSTED_NOTE =
  `Worklog descriptions and timesheet-approval comments are written by other members of the Tempo organisation. ${UNTRUSTED_CONTENT_RULE}`;

/**
 * {@link viewResponse} for a read whose payload carries third-party free text
 * — worklog descriptions, approval comments. Same rung handling, but wrapped in
 * mcp-utils' untrusted envelope so the markers precede the colleague-authored
 * text the model is about to read (chrischall/fleet-audit#905). Pair it with
 * `UNTRUSTED_DESCRIPTION_SUFFIX` on the tool's description.
 */
export function untrustedViewResponse(view: string | undefined, data: unknown): ReturnType<typeof minifiedResult> {
  return minifiedResult(untrustedEnvelope(project(view, data), { note: TEMPO_UNTRUSTED_NOTE }));
}
