import type { ToolContext } from './context';

type AuditEvent = {
  requestId: string;
  userId: string;
  orgId: string | null;
  tool: string;
  outcome: 'ok' | 'error' | 'denied';
  durationMs: number;
  error?: string;
};

/**
 * Record that a tool ran.
 *
 * Deliberately records metadata only -- who, which tool, did it work, how long.
 * Never the arguments and never the result. Tool arguments routinely carry
 * whatever the user was just talking about, so logging them turns your audit
 * trail into an unmanaged copy of your customers' data. If you need argument
 * detail for debugging, log a hash or an explicit allowlist of non-sensitive
 * fields, and set a retention period before you turn it on.
 *
 * Swap `console` for your real sink (Axiom, Datadog, a table). Keep the write
 * non-blocking and never let an audit failure fail the tool call.
 */
export function audit(event: AuditEvent): void {
  const line = JSON.stringify({ kind: 'mcp.tool', ...event });

  if (event.outcome === 'error') {
    console.error(line);
  } else {
    console.info(line);
  }
}

export function startTimer(ctx: ToolContext, tool: string) {
  const startedAt = Date.now();

  return {
    ok() {
      audit({
        requestId: ctx.requestId,
        userId: ctx.userId,
        orgId: ctx.orgId,
        tool,
        outcome: 'ok',
        durationMs: Date.now() - startedAt,
      });
    },
    denied(reason: string) {
      audit({
        requestId: ctx.requestId,
        userId: ctx.userId,
        orgId: ctx.orgId,
        tool,
        outcome: 'denied',
        durationMs: Date.now() - startedAt,
        error: reason,
      });
    },
    error(err: unknown) {
      audit({
        requestId: ctx.requestId,
        userId: ctx.userId,
        orgId: ctx.orgId,
        tool,
        outcome: 'error',
        durationMs: Date.now() - startedAt,
        error: err instanceof Error ? err.message : String(err),
      });
    },
  };
}
