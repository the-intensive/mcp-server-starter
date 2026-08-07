import {
  metadataCorsOptionsRequestHandler,
  protectedResourceHandlerClerk,
} from '@clerk/mcp-tools/next';

/**
 * OAuth Protected Resource metadata (RFC 9728).
 *
 * This is the document an MCP client fetches after it gets a 401 with a
 * `WWW-Authenticate` header. It tells the client which authorization server to
 * go talk to -- your Clerk instance.
 *
 * The path matters: it must match the `resourceMetadataPath` passed to
 * `withMcpAuth` in ../../../[transport]/route.ts. Because this server is mounted
 * at /mcp, the metadata lives at /.well-known/oauth-protected-resource/mcp.
 * If you move one, move the other.
 *
 * `scopes_supported` should list the scopes your tools actually gate on. See
 * mcp/scopes.ts -- keep the two in sync, since this is the list a client shows
 * the user on the consent screen.
 */
const handler = protectedResourceHandlerClerk({
  scopes_supported: ['profile', 'email'],
});
const corsHandler = metadataCorsOptionsRequestHandler();

export { handler as GET, corsHandler as OPTIONS };
