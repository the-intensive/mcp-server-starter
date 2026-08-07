# Auth: why Clerk, and how the SSO story works

## The problem

The MCP spec expects a remote server to be a full OAuth 2.1 authorization server. Concretely, a client that has never seen your server before must be able to:

1. Hit your endpoint, get a `401` with a `WWW-Authenticate` header pointing at your protected-resource metadata.
2. Fetch that metadata to discover which authorization server to use.
3. Fetch the authorization server's metadata to find its endpoints.
4. **Register itself as an OAuth client at runtime**, because you have never heard of it before -- this is dynamic client registration, and most MCP clients require it.
5. Run the authorization code flow with PKCE.
6. Exchange the code for an access token, and refresh it later.

Hand-rolling that is roughly 1,300 lines of fiddly, security-sensitive code -- authorize, token, register, and revoke endpoints, a token store with TTLs, refresh handling, plus the two discovery documents. It is entirely undifferentiated work, and the failure modes are quiet.

## What Clerk replaces

All of it. The entire auth surface of this starter is three small files:

- `app/[transport]/route.ts` -- roughly 15 lines of auth wiring
- `app/.well-known/oauth-authorization-server/route.ts` -- 4 lines
- `app/.well-known/oauth-protected-resource/mcp/route.ts` -- 6 lines

Clerk acts as the authorization server. It already implements dynamic client registration, PKCE, consent, token issuance, refresh, and revocation.

```ts
const authHandler = withMcpAuth(
  (req) => getHandler(req.auth?.scopes ?? [])(req),
  async (_req, token) => {
    const clerkAuth = await auth({ acceptsToken: 'oauth_token' });
    return verifyClerkToken(clerkAuth, token);
  },
  { required: true, resourceMetadataPath: '/.well-known/oauth-protected-resource/mcp' },
);
```

`acceptsToken: 'oauth_token'` is what tells Clerk to expect a machine-to-machine token from an MCP client rather than a browser session cookie.

## The SSO payoff

This is the part worth understanding, because it is the difference between "we added an MCP server" and "our enterprise customers can actually use it."

Clerk supports **enterprise SSO connections** over SAML and OIDC -- Okta, Microsoft Entra ID, Google Workspace, and any compliant OIDC provider. Connections attach to a Clerk organization, so each of your customers can bring their own IdP.

Because Clerk is the authorization server for the MCP flow, that routing is inherited rather than rebuilt. The end-user experience:

1. User adds your MCP server URL to their AI client.
2. Client discovers Clerk and registers itself.
3. User is redirected to sign in. Clerk matches their email domain to their organization's connection and **sends them to their own Okta or Entra tenant**.
4. They authenticate the way they authenticate with everything else -- existing session, corporate MFA, conditional access policies, all of it.
5. They approve the scopes, land back in the client, connected.

You wrote no SAML code. You are not managing per-customer IdP metadata in your own database. When a customer's IT team rotates a certificate or tightens a conditional access policy, that happens in their tenant and your MCP server inherits it. Deprovisioning works the same way: remove the user in the IdP and their MCP access dies with their SSO identity, which is exactly what a security reviewer will ask about.

Worth knowing for pricing conversations: Clerk's enterprise SSO allows unlimited connections without per-connection fees, which is unusual in this category and matters if you have many small enterprise customers rather than a few large ones.

## Setting it up

In the Clerk Dashboard, go to **OAuth applications**. You need to allow MCP clients to register.

Clerk supports two models, and you should choose deliberately:

**Open dynamic client registration.** Any client can register itself. Maximum compatibility -- everything just works. The trade-off is real: DCR is a public, unauthenticated endpoint, so anyone can create OAuth clients against your instance. That is an abuse and spam surface, not a data breach (they still cannot get a token without a real user completing a real login), but it is worth knowing you have opened it.

**CIMD with pre-registered clients only.** Client ID Metadata Documents let you advertise support while restricting which clients may connect. Tighter, but you must explicitly allow each client.

Via the dashboard: **OAuth applications >> CIMD Clients**, then enable "Advertise CIMD support" and "Only allow pre-registered clients to connect."

Or via CLI:

```bash
npx clerk@latest api instance/oauth_application_settings -X PATCH \
  -d '{"client_id_metadata_documents_advertised": true, "client_id_metadata_documents_only_allow_pre_registered_clients": true}'
```

Some clients omit the `scope` parameter entirely. Set instance defaults so those still get a usable token:

```bash
npx clerk@latest api instance/oauth_application_settings -X PATCH \
  -d '{"default_scopes":["openid","profile","email"]}'
```

For a first internal deployment, open DCR is the pragmatic choice. Before you point external customers at it, revisit and decide whether CIMD is warranted.

## Things that will bite you

**The `.well-known` routes must be publicly reachable.** They are how a client discovers where to log in. If your middleware protects them, clients fail during discovery with an error that does not mention discovery. This starter's `middleware.ts` deliberately leaves them open.

**The metadata path and `resourceMetadataPath` must agree.** This server is mounted at `/mcp`, so its metadata lives at `/.well-known/oauth-protected-resource/mcp`. Move one, move the other.

**Export both GET and POST** on the transport route. POST carries JSON-RPC; GET is what SSE clients open their stream on. Omitting GET breaks older clients in a way that looks like a network fault.

**Do not protect the transport route in middleware.** `withMcpAuth` needs to return the `WWW-Authenticate` header that starts the whole flow. A middleware-level block returns a bare 401 and the client has no idea where to go.

## Sources

- [Build an MCP server in your application with Clerk -- Next.js](https://clerk.com/docs/nextjs/guides/development/mcp/build-mcp-server)
- [clerk/mcp-tools](https://github.com/clerk/mcp-tools)
- [Connect MCP-compatible clients to your MCP server](https://clerk.com/docs/guides/ai/mcp/connect-mcp-client)
- [Clerk OAuth Provider improvements changelog](https://clerk.com/changelog/2025-06-13-oauth-improvements)
