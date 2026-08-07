import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import { createServices, type Services } from '../services';

/**
 * Everything a tool handler is allowed to know about the caller.
 *
 * This is the seam that keeps the starter app-agnostic. The reference server
 * this was extracted from passed a `neonClient` as a positional argument to
 * every handler, which welded the whole tool layer to one database. Here the
 * app-specific surface is a single `services` object you define, so swapping in
 * your own backend touches one file instead of every tool.
 */
export type ToolContext = {
  /** Clerk user ID of the human who authorized this connection. */
  userId: string;
  /** Clerk organization, when the token was issued in an org context. */
  orgId: string | null;
  orgRole: string | null;
  /** OAuth scopes actually granted on this token. */
  scopes: readonly string[];
  /**
   * Your app's service layer, already scoped to `userId`.
   *
   * This is the important part: tools call your existing business logic as the
   * user, so your app's own authorization still applies. See docs/TOOL-DESIGN.md
   * for why this matters more than it looks.
   */
  services: Services;
  /** Correlates every log line for one tool call. */
  requestId: string;
};

/** Raw shape Clerk puts on AuthInfo.extra. */
type ClerkAuthExtra = {
  userId?: string;
  orgId?: string;
  orgRole?: string;
};

export class UnauthenticatedError extends Error {
  constructor(message = 'Authentication required') {
    super(message);
    this.name = 'UnauthenticatedError';
  }
}

/**
 * Build a per-request context from the verified token.
 *
 * Throws if there is no user ID. That should be unreachable -- `withMcpAuth` is
 * configured with `required: true`, so an unauthenticated request never gets
 * this far -- but a tool that silently ran with `userId === undefined` would be
 * a serious hole, so we make it loud instead.
 */
export function buildContext(authInfo: AuthInfo | undefined, requestId: string): ToolContext {
  const extra = authInfo?.extra as ClerkAuthExtra | undefined;
  const userId = extra?.userId;

  if (!userId) {
    throw new UnauthenticatedError();
  }

  return {
    userId,
    orgId: extra?.orgId ?? null,
    orgRole: extra?.orgRole ?? null,
    scopes: authInfo?.scopes ?? [],
    services: createServices({ userId, orgId: extra?.orgId ?? null }),
    requestId,
  };
}
