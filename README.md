# MCP Server Starter

A production-shaped starting point for putting an MCP server in front of an existing app, so AI assistants can act on your product on behalf of a logged-in user.

Clerk handles all the OAuth. That is the headline: **your customers sign in through whatever identity provider they already use -- Okta, Entra ID, Google Workspace -- and it flows straight through to the MCP connection with no extra work from you.** See [docs/AUTH.md](docs/AUTH.md).

## What you get

- A working OAuth 2.1 authorization flow, including the discovery endpoints and dynamic client registration that MCP clients require. This is the part that eats a week if you hand-roll it.
- Enterprise SSO for free, via Clerk connections.
- Scope-gated tools -- callers only ever see the tools their grant covers.
- A tool registry with one uniform handler signature, audit logging, and a sane error contract.
- Three example tools showing the shape to copy.

## What you have to write

One file: [`mcp/tools.ts`](mcp/tools.ts). Plus [`services/index.ts`](services/index.ts), which is where you point at your app's real business logic instead of the shipped stub.

## Building this with an AI assistant

This repo ships with [`AGENTS.md`](AGENTS.md) — standing instructions for coding agents. Claude Code picks it up automatically via [`CLAUDE.md`](CLAUDE.md); Cursor, Codex, and most other agents read `AGENTS.md` directly.

It tells the agent which two files to edit, which files to leave alone, the anti-patterns to refuse (a raw-SQL tool being the big one), and the exact commands to verify its own work rather than declaring success because the code compiled.

So the workflow is just: open the repo with your assistant and tell it what your app does and what your users need to accomplish. It has the rest.

One thing worth doing yourself: skim [`docs/TOOL-DESIGN.md`](docs/TOOL-DESIGN.md) first. Which tools you expose is a product decision, and it is the decision that determines whether the finished server is good. The agent can write them well; it cannot tell you what your users are trying to do.

## Quickstart

```bash
npm install
cp .env.example .env.local     # add your Clerk keys
npm run dev
```

Then in the Clerk Dashboard, enable dynamic client registration under **OAuth applications** (details and the security trade-off are in [docs/AUTH.md](docs/AUTH.md)).

Point an MCP client at `http://localhost:3000/mcp`. For local testing the MCP Inspector is the fastest path:

```bash
npx @modelcontextprotocol/inspector
```

You should get bounced through a Clerk sign-in, land back in the client, and see three tools listed.

## Layout

| Path | What it is |
|------|------------|
| `AGENTS.md` | Standing instructions for AI coding agents. `CLAUDE.md` imports it. |
| `mcp/tools.ts` | **The file you edit.** Your tool definitions. |
| `services/index.ts` | **The other file you edit.** Adapter onto your app's business logic. Ships as a stub. |
| `mcp/registry.ts` | Tool type, scope filtering, error and result helpers. |
| `mcp/context.ts` | Per-request context handed to every tool (user, org, scopes, services). |
| `mcp/scopes.ts` | Scope definitions and the fail-closed check. |
| `mcp/audit.ts` | Metadata-only audit logging. |
| `app/[transport]/route.ts` | Auth-to-tools wiring. Serves `/mcp` and `/sse`. |
| `app/.well-known/**` | OAuth discovery documents. Must stay public. |

## Read these before you build

- **[docs/TOOL-DESIGN.md](docs/TOOL-DESIGN.md)** -- the one that actually determines whether your server is any good. Covers why exposing a generic query tool over your database is the wrong move, and what to do instead.
- **[docs/AUTH.md](docs/AUTH.md)** -- how the Clerk flow works, the SSO story, and the dynamic-client-registration security setting you need to make a deliberate call on.
- **[docs/ADAPTING.md](docs/ADAPTING.md)** -- step-by-step from clone to your own server.

## Stack

Next.js 15 App Router · `@modelcontextprotocol/sdk` · `mcp-handler` · `@clerk/nextjs` + `@clerk/mcp-tools` · Zod. Deploys to Vercel as-is; nothing here is Vercel-specific except the convenience of it.

Built and verified against: `next@15.5.23`, `@clerk/nextjs@6.39.6`, `@clerk/mcp-tools@0.2.2`, `mcp-handler@1.1.0`, `@modelcontextprotocol/sdk@1.26.0`, `zod@3.25.76`. If something in the auth wiring stops working after an upgrade, that combination is a known-good baseline to fall back to.

## What was actually tested

Not just "it compiles":

- `tsc --noEmit` clean across all files, including the `.well-known` routes (which tsc's default globs skip, because the directory starts with a dot — they were checked separately).
- `next build` succeeds and registers all three routes, confirming Next.js does serve dot-directory paths.
- Unauthenticated `POST /mcp` returns `401` with a correct `WWW-Authenticate: Bearer ... resource_metadata="..."` header pointing at the metadata route.
- `GET /.well-known/oauth-protected-resource/mcp` returns `200` with CORS headers and a well-formed document naming the Clerk authorization server.

The tools themselves have not been exercised against a live Clerk instance — that needs real keys. Step 1 of [docs/ADAPTING.md](docs/ADAPTING.md) walks through it.
