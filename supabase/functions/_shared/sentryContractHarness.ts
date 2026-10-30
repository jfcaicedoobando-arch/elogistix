import { assert, assertEquals, assertStrictEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createTransport } from "npm:@sentry/core@11.10.0";
import { context, propagation, trace } from "npm:@opentelemetry/api@1.10.0";
import { loadSentryEdge } from "./sentryRuntime.ts";

export interface Payload {
  message?: string;
  stacktrace?: unknown;
  exception?: { values?: Array<{ type?: string; value?: string; stacktrace?: {
    frames?: Array<{ filename?: string; function?: string; lineno?: number; colno?: number }>;
  } }> };
  tags?: Record<string, string>;
  user?: { id?: string };
  contexts?: { trace?: { trace_id?: string; span_id?: string; data?: Record<string, unknown> } };
  type?: string;
  transaction?: string;
  spans?: Array<{ description?: string; data?: Record<string, unknown>; parent_span_id?: string;
    links?: Array<{ attributes?: Record<string, unknown> }> }>;
  status?: string;
  check_in_id?: string;
  monitor_slug?: string;
  sdk?: { version?: string };
}

export function payloads(envelopes: string[]): Payload[] {
  return envelopes.flatMap((text) => text.split("\n").filter((line) => line.startsWith("{"))
    .flatMap((line) => { try { return [JSON.parse(line) as Payload]; } catch { return []; } }));
}

export function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

interface RequestFixture {
  name: string;
  traceId: string;
  userId: string;
  organizationId: string;
}

export function assertConcurrentReports(events: Payload[], fixture: RequestFixture): void {
  const { name, traceId, userId, organizationId } = fixture;
  const event = events.find((item) => item.message?.startsWith(`${name}:`));
  const transaction = events.find((item) => item.type === "transaction" && item.transaction === name);
  assert(event && transaction, `missing ${name} report/transaction`);
  assertEquals(event.tags?.fn, name);
  assertEquals(event.tags?.request_id, name);
  assertEquals(event.tags?.organization_id, organizationId);
  assertEquals(event.user?.id, userId);
  assertEquals(event.contexts?.trace?.trace_id, traceId);
  assertEquals(transaction.tags?.fn, name);
  assertEquals(transaction.tags?.request_id, name);
  assertEquals(transaction.contexts?.trace?.trace_id, traceId);
  const child = transaction.spans?.find((span) => span.description === `${name}-child`);
  assert(child, `missing ${name} child span`);
  assertEquals(child.parent_span_id, transaction.contexts?.trace?.span_id);
  assertEquals(child.data?.accessToken, "[REDACTED]");
}

export async function createSentryContractHarness() {
  const envKeys = ["SENTRY_DSN_EDGE", "SENTRY_RELEASE_EDGE", "SENTRY_CRON_MONITOR_SLUG"] as const;
  const previous = envKeys.map((key) => Deno.env.get(key));
  const fetchOriginal = globalThis.fetch;
  const serveOriginal = Deno.serve;
  const tracerProvider = trace.getTracerProvider();
  const activeContext = context.active();
  const propagationFields = propagation.fields();
  const otelGlobal = Reflect.get(globalThis, Symbol.for("opentelemetry.js.api.1"));
  const envelopes: string[] = [];
  const delivered: string[] = [];
  let transportCount = 0;
  let flushCount = 0;
  let heldSend: { entered: ReturnType<typeof deferred>; release: ReturnType<typeof deferred> } | undefined;
  const transport: NonNullable<Parameters<typeof loadSentryEdge>[0]> = (options) => {
    transportCount++;
    const buffered = createTransport(options, ({ body }) => {
      const text = typeof body === "string" ? body : new TextDecoder().decode(body);
      envelopes.push(text);
      const held = heldSend;
      heldSend = undefined;
      held?.entered.resolve();
      return (held?.release.promise ?? Promise.resolve()).then(() => {
        delivered.push(text);
        return { statusCode: 200 };
      });
    });
    return {
      send: buffered.send,
      flush(timeout) { flushCount++; return buffered.flush(timeout); },
    };
  };
  Deno.env.set("SENTRY_DSN_EDGE", "https://mock@mock.invalid/1");
  Deno.env.set("SENTRY_RELEASE_EDGE", "mock-contract");
  Deno.env.set("SENTRY_CRON_MONITOR_SLUG", "mock-cron");
  const first = loadSentryEdge(transport);
  const second = loadSentryEdge(transport);
  assertStrictEquals(first, second);
  const sdk = await first;
  assert(sdk);
  return {
    sdk, delivered,
    get transportCount() { return transportCount; },
    get flushCount() { return flushCount; },
    holdNextSend(held: NonNullable<typeof heldSend>) { heldSend = held; },
    assertRuntimeUnchanged() {
      assertStrictEquals(globalThis.fetch, fetchOriginal);
      assertStrictEquals(Deno.serve, serveOriginal);
      assertStrictEquals(trace.getTracerProvider(), tracerProvider);
      assertStrictEquals(context.active(), activeContext);
      assertEquals(propagation.fields(), propagationFields);
      assertStrictEquals(Reflect.get(globalThis, Symbol.for("opentelemetry.js.api.1")), otelGlobal);
    },
    async close() {
      await sdk.close(2000);
      envKeys.forEach((key, index) => {
        const value = previous[index];
        if (value === undefined) Deno.env.delete(key);
        else Deno.env.set(key, value);
      });
    },
  };
}
