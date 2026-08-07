import {
  authServerMetadataHandlerClerk,
  metadataCorsOptionsRequestHandler,
} from '@clerk/mcp-tools/next';

/**
 * OAuth Authorization Server metadata (RFC 8414).
 *
 * Older MCP clients look here to discover where to authenticate. Newer ones use
 * the protected-resource document instead, which points at this one. Serve both.
 *
 * Clerk fills this in from your instance automatically -- authorization
 * endpoint, token endpoint, registration endpoint, supported grant types.
 * You are not hand-writing an OAuth server.
 *
 * MUST be public. The CORS OPTIONS handler is required because clients fetch
 * this cross-origin from a browser context.
 */
const handler = authServerMetadataHandlerClerk();
const corsHandler = metadataCorsOptionsRequestHandler();

export { handler as GET, corsHandler as OPTIONS };
