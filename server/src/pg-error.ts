/**
 * Normalize errors from @neondatabase/serverless (NeonDbError) and nested causes.
 * Neon often nests the real Postgres error under `cause` or `sourceError`.
 */

function collectRelatedErrors(root: unknown): unknown[] {
  const out: unknown[] = [];
  const seen = new Set<unknown>();
  const queue: unknown[] = [root];
  while (queue.length) {
    const cur = queue.shift();
    if (cur === undefined || cur === null || seen.has(cur)) continue;
    seen.add(cur);
    out.push(cur);
    if (typeof cur !== 'object') continue;
    const o = cur as Record<string, unknown>;
    if ('cause' in o) queue.push(o.cause);
    if ('sourceError' in o) queue.push(o.sourceError);
  }
  return out;
}

export function postgresErrorCode(e: unknown): string | undefined {
  for (const cur of collectRelatedErrors(e)) {
    if (typeof cur === 'object' && cur !== null) {
      const code = (cur as { code?: unknown }).code;
      if (typeof code === 'string' && /^[0-9A-Z]{5}$/.test(code)) {
        return code;
      }
    }
  }
  return undefined;
}

export function errorMessageChain(e: unknown): string {
  const parts: string[] = [];
  for (const cur of collectRelatedErrors(e)) {
    if (cur instanceof Error && cur.message) parts.push(cur.message);
    else if (typeof cur === 'object' && cur !== null && 'message' in cur) {
      const m = (cur as { message: unknown }).message;
      if (typeof m === 'string' && m) parts.push(m);
    }
  }
  return [...new Set(parts)].join(' | ') || 'Unknown error';
}

/** Neon / driver could not open a DB session (wrong URL, DNS, TLS, etc.). */
export function looksLikeDbTransportFailure(e: unknown): boolean {
  const m = errorMessageChain(e).toLowerCase();
  return (
    m.includes('fetch failed') ||
    m.includes('enotfound') ||
    m.includes('econnrefused') ||
    m.includes('getaddrinfo') ||
    m.includes('error connecting to database') ||
    m.includes('connection terminated') ||
    (m.includes('ssl') && m.includes('wrong version number'))
  );
}

/** Postgres duplicate / unique violation sometimes only appears in the message. */
export function looksLikeUniqueViolation(e: unknown): boolean {
  const m = errorMessageChain(e).toLowerCase();
  return (
    m.includes('duplicate key') ||
    m.includes('unique constraint') ||
    m.includes('already exists') && m.includes('inspectors')
  );
}

/** Missing relation — message often contains "does not exist". */
export function looksLikeMissingRelation(e: unknown): boolean {
  const m = errorMessageChain(e).toLowerCase();
  return m.includes('relation') && m.includes('does not exist');
}
