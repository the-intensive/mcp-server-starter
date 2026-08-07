import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult, ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
import type { ZodRawShape } from 'zod';
import { buildContext, UnauthenticatedError, type ToolContext } from './context';
import { hasScopes, type Scope } from './scopes';
import { startTimer } from './audit';

/**
 * A tool your server exposes.
 *
 * `inputSchema` is a Zod *raw shape* -- a plain object of validators like
 * `{ projectId: z.string() }`, NOT `z.object({...})`. Tools that take no
 * arguments must still declare `inputSchema: {}`. This is not cosmetic: the MCP
 * SDK changes the handler signature based on whether `inputSchema` is present
 * (omitting it makes the first argument the extras object rather than the
 * args), and requiring it keeps every handler in this codebase identical.
 */
export type Tool<Args = Record<string, unknown>> = {
  name: string;
  /**
   * Written for the model, not for your docs site. Say what the tool does, when
   * to reach for it, and what it returns. If two tools could plausibly answer
   * the same question, say here which one wins -- that ambiguity is the most
   * common cause of a model picking wrong.
   */
  description: string;
  inputSchema: ZodRawShape;
  /** Scopes the caller must hold. Empty means any authenticated user. */
  requiredScopes: readonly Scope[];
  annotations?: ToolAnnotations;
  handler: (args: Args, ctx: ToolContext) => Promise<CallToolResult>;
};

/** Identity helper -- gives you inference on `args` without casting. */
export function defineTool<Args = Record<string, unknown>>(tool: Tool<Args>): Tool<Args> {
  return tool;
}

/** Wrap a plain object as a tool result. */
export function json(data: unknown): CallToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
}

/** Wrap prose as a tool result. */
export function text(value: string): CallToolResult {
  return { content: [{ type: 'text', text: value }] };
}

/**
 * An error the model is allowed to see and act on.
 *
 * `isError: true` tells the client this failed without killing the connection,
 * so the model can correct itself and retry. Keep the message actionable
 * ("no project with that ID; call list_projects first") and keep it free of
 * stack traces, SQL, and internal hostnames -- everything here goes into the
 * model's context and, usually, onto the user's screen.
 */
export function toolError(message: string): CallToolResult {
  return { content: [{ type: 'text', text: message }], isError: true };
}

let requestCounter = 0;
function nextRequestId(): string {
  requestCounter += 1;
  return `${Date.now().toString(36)}-${requestCounter.toString(36)}`;
}

/**
 * Register tools on the server, filtered by the caller's granted scopes.
 *
 * The filtering happens at registration time, before `tools/list` is ever
 * answered. A caller without `app:write` does not see write tools at all --
 * they are not listed, and calling one by name fails as unknown. This is
 * stronger than checking inside the handler: the model never learns the
 * capability exists, so it cannot suggest it, retry it, or tell the user about
 * it. The in-handler check below is a second line of defence, not the first.
 */
export function registerTools(
  server: McpServer,
  tools: readonly Tool<never>[],
  grantedScopes: readonly string[],
): void {
  const visible = tools.filter((tool) => hasScopes(grantedScopes, tool.requiredScopes));

  for (const tool of visible) {
    server.registerTool(
      tool.name,
      {
        description: tool.description,
        inputSchema: tool.inputSchema,
        annotations: tool.annotations,
      },
      // The SDK passes (args, extra) whenever inputSchema is declared.
      async (args: Record<string, unknown>, extra: { authInfo?: unknown }) => {
        let ctx: ToolContext;

        try {
          ctx = buildContext(
            extra.authInfo as Parameters<typeof buildContext>[0],
            nextRequestId(),
          );
        } catch (err) {
          if (err instanceof UnauthenticatedError) {
            return toolError('Authentication required.');
          }
          throw err;
        }

        const timer = startTimer(ctx, tool.name);

        // Defence in depth. Unreachable unless a token's scopes changed
        // mid-session, but cheap enough to keep.
        if (!hasScopes(ctx.scopes, tool.requiredScopes)) {
          timer.denied('insufficient_scope');
          return toolError(
            `This action needs the following permission(s): ${tool.requiredScopes.join(', ')}. Reconnect and grant access to continue.`,
          );
        }

        try {
          const result = await (tool.handler as (a: unknown, c: ToolContext) => Promise<CallToolResult>)(
            args,
            ctx,
          );
          timer.ok();
          return result;
        } catch (err) {
          timer.error(err);
          // Deliberately generic. The detail is in your logs under requestId;
          // it does not belong in the model's context.
          return toolError(
            `That request failed. Reference ${ctx.requestId} if you need to report it.`,
          );
        }
      },
    );
  }
}
