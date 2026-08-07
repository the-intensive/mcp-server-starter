/**
 * OAuth scopes your tools gate on.
 *
 * Keep this list short and coarse. Scopes are shown to the user on the Clerk
 * consent screen, so they should read like promises a human can evaluate
 * ("read your projects") -- not like internal permission flags.
 *
 * Rule of thumb: separate READ from WRITE, and split further only when you
 * genuinely expect someone to grant one and withhold the other.
 *
 * Whatever you put here must also appear in `scopes_supported` in
 * app/.well-known/oauth-protected-resource/mcp/route.ts.
 */
export const SCOPES = {
  /** Identify the user. Clerk grants these by default. */
  PROFILE: 'profile',
  EMAIL: 'email',

  /** Read-only access to the user's app data. */
  READ: 'app:read',

  /** Create and modify. Anything with a side effect belongs behind this. */
  WRITE: 'app:write',
} as const;

export type Scope = (typeof SCOPES)[keyof typeof SCOPES];

/**
 * True if every required scope was granted.
 *
 * Note the failure direction: no scopes granted means no gated tools. We fail
 * closed on purpose. A bug here should remove capability, never add it.
 */
export function hasScopes(granted: readonly string[], required: readonly Scope[]): boolean {
  if (required.length === 0) return true;
  const set = new Set(granted);
  return required.every((scope) => set.has(scope));
}
