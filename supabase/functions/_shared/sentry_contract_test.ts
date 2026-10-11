import { assert, assertEquals, assertRejects, assertStrictEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createTransport } from "npm:@sentry/core@11.4.0";
import { context, propagation, trace } from "npm:@opentelemetry/api@1.9.1";
import { captureEdgeException, captureEdgeMessage, wrapEdgeHandler, withCronMonitor } from "./sentry.ts";
import { getEdgeScope } from "./sentryRequestScope.ts";
import { loadSentryEdge } from "./sentryRuntime.ts";

Deno.test("No DSN: preserve responses and exceptions without telemetry", async () => {
  const previous = Deno.env.get("SENTRY_DSN_EDGE");
  Deno.env.delete("SENTRY_DSN_EDGE");
  try {
    assertEquals(await loadSentryEdge(), null);
    await captureEdgeMessage("no transport", "info", { fn: "no-dsn" });
    const response = await withCronMonitor("no-dsn", "disabled", () => new Response("ok", { status: 202 }),
      { schedule: { type: "interval", value: 1, unit: "hour" } })(new Request("https://mock.invalid/"));
    assertEquals(response.status, 202);
    await assertRejects(() => wrapEdgeHandler("no-dsn", () => { throw new Error("unchanged"); })(
      new Request("https://mock.invalid/")), Error, "unchanged");
  } finally {
    if (previous !== undefined) Deno.env.set("SENTRY_DSN_EDGE", previous);
  }
});

interface Payload {
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

function payloads(envelopes: string[]): Payload[] {
  return envelopes.flatMap((text) => text.split("\n").filter((line) => line.startsWith("{"))
    .flatMap((line) => { try { return [JSON.parse(line) as Payload]; } catch { return []; } }));
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

// No --allow-net is needed. Use Sentry's actual envelope/buffer transport with
// an in-memory request executor; never replace fetch, Deno.serve, or OTEL APIs.
Deno.test("SDK 11.4.0: offline real SDK contracts", async (t) => {
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
  try {
    await t.step("init/version/singleton, restrictive collection, no runtime or OTEL patching", () => {
      assertEquals(sdk.SDK_VERSION, "11.4.0");
      assertEquals(transportCount, 1);
      assertStrictEquals(sdk.getClient(), sdk.getCurrentScope().getClient());
      const options = sdk.getClient<InstanceType<typeof sdk.DenoClient>>()!.getOptions();
      assertEquals(options.enableOpenTelemetrySetup, false);
      assertEquals(options.attachStacktrace, false);
      assertEquals(options.integrations, []);
      assertEquals(options.traceLifecycle, "static");
      assert(!("skipOpenTelemetrySetup" in options));
      assert(!("sendDefaultPii" in options));
      assertEquals(options.dataCollection, {
        userInfo: false, cookies: false, httpHeaders: false, httpBodies: [], urlQueryParams: false,
        genAI: { inputs: false, outputs: false }, databaseQueryData: false, queues: false,
        stackFrameVariables: false, frameContextLines: 0, graphQL: { document: false, variables: false },
      });
      assertStrictEquals(globalThis.fetch, fetchOriginal);
      assertStrictEquals(Deno.serve, serveOriginal);
      assertStrictEquals(trace.getTracerProvider(), tracerProvider);
      assertStrictEquals(context.active(), activeContext);
      assertEquals(propagation.fields(), propagationFields);
      assertStrictEquals(Reflect.get(globalThis, Symbol.for("opentelemetry.js.api.1")), otelGlobal);
      // Deterministic test sampling only; production remains at 0.1.
      options.tracesSampleRate = 1;
    });

    await t.step("messages omit synthetic stacks while sanitized Error stacks remain", async () => {
      for (const level of ["info", "error"] as const) {
        const message = `message-without-stack-${level}`;
        await captureEdgeMessage(message, level, { fn: "message-privacy" });
        const event = payloads(delivered).find((item) => item.message === message);
        assert(event, "missing real message event");
        assertEquals(event.stacktrace, undefined);
        assertEquals(event.exception, undefined, "captureMessage must not attach a synthetic exception stack");
        assert(!/"(?:filename|function|lineno|colno)"\s*:/.test(JSON.stringify(event)),
          "message includes stack frame fields");
      }
      const error = new Error("exception-with-stack Bearer MOCK_EXCEPTION_TOKEN mock@example.invalid RFC XAXX010101000");
      error.stack = `${error.name}: ${error.message}\n    at intendedException (/edge/request.ts:22:7)`;
      await captureEdgeException(error, { fn: "exception-privacy", extra: { accessToken: "MOCK_EXCEPTION_ACCESS" } });
      const event = payloads(delivered).find((item) => item.exception?.values?.some((value) =>
        value.value?.startsWith("exception-with-stack")));
      assert(event, "missing real Error event");
      const captured = event.exception!.values!.find((value) => value.value?.startsWith("exception-with-stack"))!;
      assertEquals(captured.type, "Error");
      assert(captured.stacktrace?.frames?.some((frame) => frame.filename === "/edge/request.ts"
        && frame.function === "intendedException" && frame.lineno === 22 && frame.colno === 7),
        "intended Error stack must remain available");
      assert(!/MOCK_EXCEPTION_TOKEN|MOCK_EXCEPTION_ACCESS|mock@example.invalid|XAXX010101000/.test(JSON.stringify(event)),
        "Error event includes sensitive synthetic data");
      assert(captured.value?.includes("Bearer [REDACTED]"));
    });

    await t.step("overlapping requests retain separate tags, traces and child parents", async () => {
      const gate = deferred();
      let started = 0;
      const traces = { alpha: "0123456789abcdef0123456789abcdef", beta: "fedcba9876543210fedcba9876543210" };
      const users = { alpha: "ab30d6a0-232a-4ed2-8e22-e028681eceeb", beta: "2bc2d764-a9fe-4f1a-9712-7bb2bb3a06d3" };
      const organizations = { alpha: "84b09db2-f2bd-49a9-ab98-c54c9d0b3073", beta: "e8d4cf6b-3dac-471b-a1c5-a1e2b604da8d" };
      await Promise.all((["alpha", "beta"] as const).map((name) => wrapEdgeHandler(name, async () => {
        if (++started === 2) gate.resolve();
        await gate.promise;
        const child = sdk.withScope(getEdgeScope(), () => sdk.startInactiveSpan({
          name: `${name}-child`, attributes: { accessToken: "MOCK_ACCESS", note: "RFC XAXX010101000" },
        }));
        await captureEdgeMessage(`${name}: mock@example.invalid RFC XAXX010101000 Bearer MOCK_TOKEN`, "error", {
          fn: name, user_id: users[name], organization_id: organizations[name],
          extra: { accessToken: "MOCK_ACCESS", customerEmail: "mock@example.invalid" },
        });
        child.end();
        return new Response(name, { status: name === "alpha" ? 202 : 207 });
      })(new Request("https://mock.invalid/function", { headers: {
        "x-request-id": name, "sentry-trace": `${traces[name]}-0123456789abcdef-1`,
      } }))));
      const events = payloads(delivered);
      for (const name of ["alpha", "beta"] as const) {
        const event = events.find((item) => item.message?.startsWith(`${name}:`));
        const transaction = events.find((item) => item.type === "transaction" && item.transaction === name);
        assert(event && transaction, `missing ${name} report/transaction`);
        assertEquals(event.tags?.fn, name);
        assertEquals(event.tags?.request_id, name);
        assertEquals(event.tags?.organization_id, organizations[name]);
        assertEquals(event.user?.id, users[name]);
        assertEquals(event.contexts?.trace?.trace_id, traces[name]);
        assertEquals(transaction.tags?.fn, name);
        assertEquals(transaction.tags?.request_id, name);
        assertEquals(transaction.contexts?.trace?.trace_id, traces[name]);
        const child = transaction.spans?.find((span) => span.description === `${name}-child`);
        assert(child, `missing ${name} child span`);
        assertEquals(child.parent_span_id, transaction.contexts?.trace?.span_id);
        assertEquals(child.data?.accessToken, "[REDACTED]");
      }
      assertEquals(getEdgeScope(), undefined);
      await captureEdgeMessage("outside-request", "info", { fn: "outside" });
      const outside = payloads(delivered).find((item) => item.message === "outside-request");
      assert(outside);
      assertEquals(outside.tags?.fn, "outside");
      assertEquals(outside.tags?.request_id, undefined);
      assertEquals(outside.tags?.organization_id, undefined);
      assertEquals(outside.user, undefined);
    });

    await t.step("root/child names, metadata and link attributes are scrubbed before transport", async () => {
      sdk.withScope((scope) => {
        scope.setTag("accessToken", "MOCK_ROOT_TAG");
        scope.setExtra("customerEmail", "mock@example.invalid");
        scope.setUser({ id: "b716e8b9-2d0a-4c5d-a6fe-fb0a6a28a3bc", email: "mock@example.invalid" });
        sdk.startSpan({ name: "privacy-root Bearer MOCK_ROOT", forceTransaction: true, attributes: {
          accessToken: "MOCK_ROOT_ATTR", customerEmail: "mock@example.invalid", note: "RFC XAXX010101000",
        } }, (root) => {
          root.addLink({ context: { traceId: "a".repeat(32), spanId: "b".repeat(16), traceFlags: 1 },
            attributes: { accessToken: "MOCK_ROOT_LINK" } });
          sdk.startSpan({ name: "privacy-child Bearer MOCK_CHILD", attributes: {
            accessToken: "MOCK_CHILD_ATTR", customerEmail: "mock@example.invalid",
          } }, (child) => {
            child.addLink({ context: { traceId: "c".repeat(32), spanId: "d".repeat(16), traceFlags: 1 },
              attributes: { accessToken: "MOCK_CHILD_LINK" } });
          });
        });
      });
      await sdk.flush(2000);
      const root = payloads(delivered).find((event) => event.transaction?.startsWith("privacy-root"));
      assert(root, "missing scrubbed root");
      assertEquals(root.transaction, "privacy-root Bearer [REDACTED]");
      assertEquals(root.contexts?.trace?.data?.accessToken, "[REDACTED]");
      const child = root.spans?.find((span) => span.description?.startsWith("privacy-child"));
      assert(child, "missing scrubbed child");
      assertEquals(child.description, "privacy-child Bearer [REDACTED]");
      assertEquals(child.data?.accessToken, "[REDACTED]");
      assertEquals(child.links?.[0].attributes?.accessToken, "[REDACTED]");
      const json = delivered.join("\n");
      assert(!/mock@example.invalid|XAXX010101000|MOCK_(?:TOKEN|ACCESS|ROOT|CHILD)/.test(json), "sensitive synthetic data reached transport");
      assert(json.includes("libre-carga-edge@mock-contract"));
      assert(payloads(delivered).some((event) => event.sdk?.version === "11.4.0"));
    });

    await t.step("flush waits for actual buffered delivery and honors its timeout", async () => {
      const hold = { entered: deferred(), release: deferred() };
      heldSend = hold;
      // The SDK unrefs drain timers; a memory executor has no socket to keep
      // Deno's loop alive while we test the bounded timeout.
      const keepAlive = setTimeout(() => undefined, 1000);
      sdk.captureMessage("bounded-flush");
      let finished = false;
      const flushing = sdk.flush(50).then((result) => { finished = true; return result; });
      try {
        await hold.entered.promise;
        assertEquals(await sdk.flush(1), false);
        assertEquals(finished, false);
      } finally {
        hold.release.resolve();
        clearTimeout(keepAlive);
      }
      assertEquals(await flushing, true);
      assert(delivered.some((text) => text.includes("bounded-flush")));
      // SDK 11.4.0's PromiseBuffer races an unrefed timer without cancelling it
      // when delivery wins. Let that specific 50ms timer finish; keep sanitizers on.
      await new Promise((resolve) => setTimeout(resolve, 60));
    });

    await t.step("cron allowlist, paired check-ins and terminal delivery preserve HTTP/throw behavior", async () => {
      const config = { schedule: { type: "interval" as const, value: 1, unit: "hour" as const } };
      const beforeDisabled = payloads(delivered).filter((p) => p.monitor_slug).length;
      const disabled = await withCronMonitor("disabled", "not-enabled", () => new Response("skip", { status: 202 }),
        config)(new Request("https://mock.invalid/cron"));
      assertEquals(disabled.status, 202);
      assertEquals(payloads(delivered).filter((p) => p.monitor_slug).length, beforeDisabled);
      for (const terminal of ["ok", "error", "throw"] as const) {
        const before = delivered.length;
        const beforeFlush = flushCount;
        const wrapped = withCronMonitor("cron", "mock-cron", () => {
          if (terminal === "throw") throw new Error("MOCK_BUG");
          return new Response("cron-response", { status: terminal === "ok" ? 202 : 503 });
        }, config);
        if (terminal === "throw") {
          await assertRejects(() => wrapped(new Request("https://mock.invalid/cron")), Error, "MOCK_BUG");
        } else {
          const response = await wrapped(new Request("https://mock.invalid/cron"));
          assertEquals(response.status, terminal === "ok" ? 202 : 503);
          assertEquals(await response.text(), "cron-response");
        }
        assert(flushCount > beforeFlush);
        const checkins = payloads(delivered.slice(before)).filter((p) => p.monitor_slug === "mock-cron");
        assertEquals(checkins.length, 2, "both check-ins must be delivered before return/rethrow");
        assertEquals(checkins[0].status, "in_progress");
        assertEquals(checkins[1].status, terminal === "ok" ? "ok" : "error");
        assertEquals(checkins[1].check_in_id, checkins[0].check_in_id);
      }
    });
    assertStrictEquals(globalThis.fetch, fetchOriginal);
    assertStrictEquals(Deno.serve, serveOriginal);
    assertStrictEquals(trace.getTracerProvider(), tracerProvider);
  } finally {
    await sdk.close(2000);
    envKeys.forEach((key, index) => {
      const value = previous[index];
      if (value === undefined) Deno.env.delete(key);
      else Deno.env.set(key, value);
    });
  }
});
