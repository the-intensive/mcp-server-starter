# Adapting this to your app

Roughly a day's work to something real, assuming your app already has a service layer worth calling.

## 1. Get it running unmodified

```bash
npm install
cp .env.example .env.local
```

Add your Clerk keys from **Clerk Dashboard >> API keys**, then enable dynamic client registration under **OAuth applications** (see [AUTH.md](AUTH.md) for the security trade-off).

```bash
npm run dev
npx @modelcontextprotocol/inspector   # in another terminal
```

Connect to `http://localhost:3000/mcp`. You should get a Clerk sign-in, then three tools backed by fake data.

Do not skip this. If you start editing before the baseline works, you will not know whether a later failure is your code or your Clerk config.

## 2. Point `services/` at your real app

Open [`services/index.ts`](../services/index.ts) and replace the stub.

The one rule: **call the same business logic your web app calls.** Your existing service objects, repository classes, or internal API. Not a fresh database connection.

That single decision is what keeps the MCP server inside your existing permission model instead of beside it. `createServices` receives the caller's identity and closes over it, so individual methods cannot forget to scope themselves — but that only helps if what they call actually enforces something.

If your app has no service layer and everything lives in route handlers, extract the handful of operations you want to expose first. Worth doing regardless.

## 3. Replace the tools

Open [`mcp/tools.ts`](../mcp/tools.ts). Delete the three examples and write yours, following the same shape.

Start with **read-only tools covering your three most common user questions.** Ship that, watch how the model uses it, then add writes. Read-only is a much easier security conversation and teaches you what the model actually reaches for.

Read [TOOL-DESIGN.md](TOOL-DESIGN.md) before this step, not after.

## 4. Set your scopes

Edit [`mcp/scopes.ts`](../mcp/scopes.ts) if the default read/write split does not fit.

Then mirror whatever you land on in `scopes_supported` in [`app/.well-known/oauth-protected-resource/mcp/route.ts`](../app/.well-known/oauth-protected-resource/mcp/route.ts). These two have to agree — that list is what the user sees on the consent screen.

## 5. Wire up audit logging

[`mcp/audit.ts`](../mcp/audit.ts) writes to `console`. Point it at wherever your logs actually go.

It records metadata only — who, which tool, outcome, duration — never arguments or results. Keep it that way. Tool arguments carry whatever the user was just discussing, so logging them turns your audit trail into an unmanaged copy of customer data. If you need argument detail, log a hash or an explicit allowlist of non-sensitive fields, and set retention before you enable it.

## 6. Deploy

Deploys to Vercel with no changes. Set the same env vars in your project settings, and make sure `SERVER_HOST` matches the public URL — it goes into the OAuth metadata, so a mismatch breaks discovery in a way that is annoying to debug.

Any Node host works; nothing here is Vercel-specific.

## 7. Test with a real client

Connect Claude or another MCP client and run through the ten things your users will genuinely ask.

Watch which tools get picked. When the model picks wrong, fix the description before you touch the code — that is the cause far more often than the logic.

## Checklist before you point customers at it

- [ ] Every tool goes through your app's authorization, not around it
- [ ] No tool accepts raw SQL, a raw query object, or an arbitrary URL
- [ ] Write tools are behind a separate scope from read tools
- [ ] `destructiveHint` is set honestly on every tool
- [ ] Write tools are idempotent, or safe to run twice
- [ ] Errors are actionable and leak no internals
- [ ] Audit logging goes somewhere you would actually look
- [ ] You have made a deliberate call on open DCR vs CIMD
- [ ] List endpoints paginate
- [ ] A real client has been connected and exercised end to end
