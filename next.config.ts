import type { NextConfig } from 'next';

/**
 * No rewrites needed. `app/[transport]/route.ts` is a dynamic segment, so it
 * already serves both `/mcp` (current spec) and `/sse` (older clients) and can
 * read which one was requested from its params.
 *
 * If you mount the server somewhere else (e.g. `/api/mcp`), remember to update
 * `resourceMetadataPath` in the route handler and the `.well-known` path to
 * match -- the two have to agree or discovery breaks.
 */
const nextConfig: NextConfig = {};

export default nextConfig;
