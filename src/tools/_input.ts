/**
 * Helpers for mapping a Tempo resource to its update input shape — the
 * `toInput` half of `prepareMergedUpdate` (@chrischall/mcp-utils), which owns
 * the read-modify-write itself (Tempo v4 PUTs replace the whole resource).
 */

type Obj = Record<string, unknown>;

export function asObj(v: unknown): Obj {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : {};
}

/**
 * Keep only the entries whose value is not undefined/null — so a field Tempo
 * returns as null is omitted from the PUT rather than sent as an explicit null
 * (mcp-utils' `pruneUndefined` keeps nulls, so it is not a substitute).
 */
export function defined(entries: Obj): Obj {
  return Object.fromEntries(Object.entries(entries).filter(([, v]) => v !== undefined && v !== null));
}
