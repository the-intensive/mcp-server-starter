# Instructions for AI agents working in this repo

You are adapting a **template**. It is not an app to be finished — it is a working skeleton someone is turning into an MCP server for their own product. Read this before changing anything.

## What this repo is

A remote MCP server built on Next.js, where Clerk acts as the OAuth 2.1 authorization server. The auth is already correct and already tested. The tools are placeholders.

## The job

The user wants their app's capabilities exposed to AI assistants. In almost every case that means:

1. Replace `services/index.ts` with an adapter onto their real business logic.
2. Replace the example tools in `mcp/tools.ts` with tools for their domain.
3. Nothing else.

**Ask what their app does and what its users actually need to accomplish before you write a single tool.** Tool design is the whole game here, and it depends entirely on their domain. Do not guess it from the folder structure or from a schema dump. If they haven't told you what the app does, that is your first question.

## Rules — do not violate these

**Never add a tool that takes raw SQL, a raw query object, an arbitrary URL, or a shell command.** This is the single most common failure mode, and it is tempting because it looks flexible. It is wrong here: it bypasses the authorization the user's app already enforces, so the model can reach data the signed-in user could never see in the product. It also turns prompt injection into arbitrary database access. If the user explicitly asks for one, push back once and explain why, then follow their decision.

**Every tool must call through `ctx.services`.** Do not open a database connection, do not call an ORM directly, do not `fetch` an internal endpoint from inside a tool handler. `services/index.ts` is the only place the outside world gets touched, and it is where the user's own authorization runs.

**Do not rewrite the auth.** `app/[transport]/route.ts`, `app/.well-known/**`, `middleware.ts`, `mcp/context.ts` and `mcp/registry.ts` are verified working. If auth appears broken, it is a configuration problem in the Clerk Dashboard or a `.env.local` problem, not a code problem. Read `docs/AUTH.md` before touching any of it.

**Keep scopes in sync.** Any scope in `mcp/scopes.ts` must also appear in `scopes_supported` in `app/.well-known/oauth-protected-resource/mcp/route.ts`. That list is what the user sees on the consent screen.

**Put every side-effecting tool behind `SCOPES.WRITE`.** Reads and writes get different scopes, always.

## How to write a good tool

Read `docs/TOOL-DESIGN.md` in full. The essentials:

- One tool per user intent, not per database table. `list_projects` yes, `query_table` no.
- Return a trimmed projection, not the full record. Everything returned is spent from the model's context window.
- Paginate anything unbounded.
- The `description` is a prompt, not documentation. Say when to use it, and when two tools overlap, say which wins.
- `.describe()` every parameter.
- Errors should tell the model how to recover: `"No project found with id X. Call list_projects to see valid ids."` — not `"not found"`. Use the `toolError` helper, never throw.
- Set `destructiveHint` honestly. Reserve it for updates and deletes.

Copy the shape of the three examples already in `mcp/tools.ts`, then delete them.

## Gotchas that will waste your time

**`inputSchema` is a Zod raw shape, not a `z.object()`.** Write `{ id: z.string() }`. Tools with no arguments still need `inputSchema: {}` — omitting it silently changes the SDK's handler signature so the first argument becomes the extras object instead of the args.

**`tsc` does not check the `.well-known` routes.** TypeScript's default globs skip directories starting with a dot. `npm run typecheck` passing does not mean those two files compile. Check them explicitly (command below).

**`resourceMetadataPath` and the `.well-known` folder path must match.** The server is mounted at `/mcp`, so its metadata lives at `/.well-known/oauth-protected-resource/mcp`. If you move one, move the other, or discovery breaks with an error that does not mention discovery.

**Export both `GET` and `POST`** from the transport route. POST carries JSON-RPC; GET is what SSE clients open their stream on.

**Do not protect `/[transport]` or `/.well-known/**` in middleware.** `withMcpAuth` must be allowed to return the `WWW-Authenticate` header that starts the OAuth flow. Blocking earlier yields a bare 401 and the client has nowhere to go.

**The tool list is built per scope-set,** which is why `app/[transport]/route.ts` builds and caches a handler per scope combination rather than once at module load. Do not "simplify" that back to a single module-level handler — it would leak write tools to read-only callers.

## Verifying your work

Do not tell the user it works because it compiled. Run these.

```bash
npm install
npm run typecheck                                  # expect: no output, exit 0
```

The `.well-known` routes are skipped above, so check them separately:

```bash
npx tsc --noEmit --skipLibCheck --module esnext --moduleResolution bundler \
  --target ES2022 --strict --esModuleInterop --jsx preserve \
  'app/.well-known/oauth-authorization-server/route.ts' \
  'app/.well-known/oauth-protected-resource/mcp/route.ts'
```

Then build — this also confirms Next.js is serving the dot-directory routes:

```bash
npm run build
```

Expect all three in the route table: `/[transport]`, `/.well-known/oauth-authorization-server`, `/.well-known/oauth-protected-resource/mcp`. If a `.well-known` route is missing, discovery is broken no matter what the code looks like.

Finally, probe it running. Pick a port and confirm it is free first — a port already in use will serve you someone else's app and the 404s will look like your bug:

```bash
npm run start -- -p 3921
curl -s -i -X POST http://localhost:3921/mcp \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | head -8
```

Expect `401` plus a `www-authenticate: Bearer ... resource_metadata="..."` header pointing at the metadata path. That header is the whole OAuth handshake starting correctly.

```bash
curl -s http://localhost:3921/.well-known/oauth-protected-resource/mcp
```

Expect `200` and JSON naming the Clerk authorization server.

With real Clerk keys, connect a live client and confirm the tools list and run:

```bash
npx @modelcontextprotocol/inspector
```

## Definition of done

- [ ] Every tool calls through `ctx.services`
- [ ] No tool accepts SQL, a raw query, an arbitrary URL, or a command
- [ ] Write tools are behind `SCOPES.WRITE`, reads are not
- [ ] `mcp/scopes.ts` and `scopes_supported` agree
- [ ] Typecheck clean, including the two `.well-known` files
- [ ] Build registers all three routes
- [ ] Unauthenticated `POST /mcp` returns 401 with `WWW-Authenticate`
- [ ] Errors are actionable and leak no internals, SQL, or hostnames
- [ ] A real MCP client has listed and called at least one tool

## When you are unsure

Prefer asking over guessing, especially about what the user's app does and who its users are. A wrong guess about the domain produces a plausible-looking set of tools that solve nobody's problem, and that is expensive to unwind later.
