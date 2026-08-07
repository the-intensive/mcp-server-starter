import { verifyClerkToken } from '@clerk/mcp-tools/next';
import { auth } from '@clerk/nextjs/server';
import { createMcpHandler, withMcpAuth } from 'mcp-handler';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerTools } from '../../mcp/registry';
import { TOOLS } from '../../mcp/tools';

/**
 * The MCP server.
 *
 * Intentionally thin -- it wires auth to tools and nothing else. Your work
 * happens in mcp/tools.ts.
 *
 * Because this is a `[transport]` dynamic segment it serves both `/mcp` (the
 * current spec) and `/sse` (older clients). Export both GET and POST: POST
 * carries the JSON-RPC traffic, GET is what SSE clients open their stream on.
 */

function createHandlerForScopes(scopes: readonly string[]) {
  return createMcpHandler(
    (server: McpServer) => {
      registerTools(server, TOOLS, scopes);
    },
    {
      serverInfo: {
        name: 'mcp-server-starter',
        version: '0.1.0',
      },
      capabilities: { tools: {} },
    },
    {
      // Optional. Set REDIS_URL to support SSE across serverless invocations.
      // Streamable HTTP (/mcp) does not need it.
      redisUrl: process.env.REDIS_URL,
      maxDuration: 300,
      verboseLogs: process.env.NODE_ENV !== 'production',
    },
  );
}

/**
 * The set of registered tools depends on the caller's scopes, so the handler
 * has to be built per scope-set rather than once at module load. In practice
 * there are only a handful of distinct scope combinations, so we cache them
 * instead of rebuilding on every request.
 *
 * Keyed on sorted scopes so that ['a','b'] and ['b','a'] share an entry.
 */
const handlerCache = new Map<string, ReturnType<typeof createHandlerForScopes>>();

function getHandler(scopes: readonly string[]) {
  const key = [...scopes].sort().join(' ');
  let handler = handlerCache.get(key);

  if (!handler) {
    handler = createHandlerForScopes(scopes);
    handlerCache.set(key, handler);
  }

  return handler;
}

type AuthedRequest = Request & { auth?: AuthInfo };

const authHandler = withMcpAuth(
  // withMcpAuth verifies the token first, then attaches the result to the
  // request before calling through to here.
  (req: AuthedRequest) => getHandler(req.auth?.scopes ?? [])(req),
  async (_req, token) => {
    // `acceptsToken: 'oauth_token'` tells Clerk this is a machine-to-machine
    // OAuth token from an MCP client, not a browser session cookie.
    const clerkAuth = await auth({ acceptsToken: 'oauth_token' });
    return verifyClerkToken(clerkAuth, token);
  },
  {
    required: true,
    // Must match the folder path under app/.well-known/. If these disagree,
    // clients 401 and then fail discovery with no useful error.
    resourceMetadataPath: '/.well-known/oauth-protected-resource/mcp',
  },
);

export { authHandler as GET, authHandler as POST };
