/**
 * Read-modify-write support for Tempo's update endpoints.
 *
 * Tempo v4 PUTs REPLACE the whole resource — "any fields not specified in the
 * request will be reset to their default values or removed" (tempo-openapi.yaml,
 * PUT semantics). A body built from only the caller's arguments therefore wipes
 * every field the caller didn't mention (a worklog's description and _Account_
 * attribute, an account's lead, a team's summary...). The update tools instead
 * GET the current resource, map it to the input shape, and merge the caller's
 * fields over it.
 */

type Obj = Record<string, unknown>;

export function asObj(v: unknown): Obj {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : {};
}

/** Keep only the entries whose value is not undefined/null. */
export function defined(entries: Obj): Obj {
  return Object.fromEntries(Object.entries(entries).filter(([, v]) => v !== undefined && v !== null));
}

/** Current resource (already mapped to the input shape) with the caller's defined fields on top. */
export function mergeOverCurrent(current: Obj, patch: Obj): Obj {
  return { ...current, ...defined(patch) };
}

export const UPDATE_MERGE_NOTE =
  'Fields you omit keep their current values: the tool reads the current resource and merges your fields over it (Tempo\'s PUT replaces the whole resource, so an update built from only the changed fields would wipe the rest). Without confirm:true it performs that read and returns a dry-run preview of the full merged body, making NO write; with confirm:true it applies the update.';
