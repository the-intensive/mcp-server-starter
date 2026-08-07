# Designing the tools

The auth is solved. The tools are where your server is actually good or bad, and it is worth spending real thought here.

## The mistake to avoid

The tempting shortcut is one flexible tool:

```
query_database(sql: string)
```

It looks elegant. One tool, infinite capability, no ongoing work as your schema evolves. This is also roughly what an MCP server over a data warehouse looks like, so if you are adapting one of those as a reference, this is the shape you will drift into.

Do not do it for an application.

**It routes around your authorization.** Your app spent years accumulating rules about who can see what -- row ownership, org boundaries, role checks, soft deletes, feature flags. A raw SQL tool honours none of them. The model can read every row of every tenant. You have effectively granted every connected AI client the permissions of your database user, which is not what the person clicking "Approve" thought they were agreeing to.

**Injection stops being theoretical.** The model composes the query from text it read somewhere -- a support ticket, a web page, a PDF the user uploaded. Prompt injection now writes SQL against your production database.

**It is unreliable.** The model has to infer your schema, guess at your conventions, and get joins right on the first try. It will not. You will spend more time writing a schema pre-prompt to make it accurate than you would have spent writing twelve good tools.

**Writes are worse.** A generic write tool means an over-eager model can `UPDATE` without a `WHERE`.

A data warehouse gets away with this because it is a read-only copy, the analytics use case genuinely is open-ended, and the audience is analysts who would otherwise write the SQL themselves. An application is none of those things.

## What to do instead

One tool per user intent, mapped onto business logic you already have.

```
list_projects(includeArchived?)
get_project_tasks(projectId)
create_task(projectId, title)
```

Each one calls your service layer, which enforces your existing rules. The model composes *actions*, not queries. Ask "what would a user want to do?" -- not "what tables do I have?"

Fifteen well-named tools beats one flexible one. If you are past thirty, that is a signal you are modelling tables rather than intents.

## Return less than you think

Everything a tool returns is spent from the model's context window. Return the full record and you crowd out the actual conversation, which makes answers worse, slower, and more expensive.

Return a projection with the fields needed to answer the question or to call the next tool. Add a `get_project_detail` tool for when the model genuinely needs everything.

Paginate anything unbounded. A tool that returns 4,000 rows is a tool that breaks the conversation.

## Write descriptions for the model

The description is not documentation, it is a prompt. Say what the tool does, when to use it, and what it gives back.

Most tool-selection failures come from two tools that plausibly answer the same question. When that happens, say so explicitly in the description -- "use `search_projects` when you have a name, `list_projects` when you want everything."

Describe the parameters too. `projectId: z.string().describe('The project id, e.g. "proj_001"')` stops the model passing a project *name* and getting a confusing failure.

## Make errors recoverable

A failed tool call is not the end -- the model can correct itself and retry, if you tell it how.

```
"No project found with id 'proj_999'. Call list_projects to see valid ids."
```

Not `Error: not found`. The first one gets fixed on the next turn; the second becomes an apology to the user.

Use `isError: true` (the `toolError` helper) rather than throwing. Throwing surfaces as a transport failure and the model cannot reason about it.

Never leak internals into an error string. Stack traces, SQL fragments, and internal hostnames all end up in the model's context and usually on the user's screen. Log the detail server-side against `requestId` and return the reference.

## Scopes and side effects

Split read from write and gate every side-effecting tool behind `SCOPES.WRITE`. Because filtering happens before registration, a read-only grant means write tools are never listed -- the model does not know they exist and cannot offer them.

Set the annotations honestly. `readOnlyHint` and `destructiveHint` are surfaced by clients to decide how hard to confirm with the user. Reserve `destructiveHint` for updates and deletes -- marking a harmless create as destructive trains people to click through warnings, which costs you the one time it mattered.

For genuinely dangerous operations, consider not shipping a tool at all. A tool that returns a confirmation link into your app, where the user completes the action with full context, is often the better design.

## Idempotency

Models retry. Network calls time out and get repeated. If `create_task` can fire twice, some user gets two tasks.

Accept a client-supplied idempotency key on write tools, or de-duplicate on a natural key within a short window. Set `idempotentHint` accurately so clients know whether a retry is safe.

## Test it with a real client

Unit tests will not tell you whether the model *picks* the right tool. Connect a real client and try the ten things your users will actually ask. Watch which tools get chosen.

When it picks wrong, the fix is almost always the description, not the code.
