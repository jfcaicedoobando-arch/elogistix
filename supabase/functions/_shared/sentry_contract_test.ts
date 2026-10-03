import { assert, assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { captureEdgeMessage, wrapEdgeHandler, withCronMonitor } from "./sentry.ts";
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

Deno.test("SDK 10: isolated manual reports, redaction, spans and terminal cron check-ins", async () => {
  const fetchOriginal = globalThis.fetch;
  const serveOriginal = Deno.serve;
  const envelopes: string[] = [];
  Deno.env.set("SENTRY_DSN_EDGE", "https://mock@mock.invalid/1");
  Deno.env.set("SENTRY_RELEASE_EDGE", "mock-contract");
  Deno.env.set("SENTRY_CRON_MONITOR_SLUG", "mock-cron");
  globalThis.fetch = (_url, options) => {
    const body = (options as { body?: unknown } | undefined)?.body;
    envelopes.push(typeof body === "string" ? body : new TextDecoder().decode(body as Uint8Array));
    return Promise.resolve(new Response("", { status: 200 }));
  };
  const sdk = await loadSentryEdge();
  assert(sdk);
  assertEquals(sdk.SDK_VERSION, "10.76.0");
  assertEquals(Deno.serve, serveOriginal);
  assertEquals(sdk.getClient<InstanceType<typeof sdk.DenoClient>>()!.getOptions().skipOpenTelemetrySetup, true);
  sdk.getClient()!.getOptions().tracesSampleRate = 1;
  const incoming = "0123456789abcdef0123456789abcdef-0123456789abcdef-1";
  try {
    await Promise.all(["alpha", "beta"].map((name) => wrapEdgeHandler(name, async () => {
      await Promise.resolve();
      await captureEdgeMessage(`${name}: mock@example.invalid RFC XAXX010101000 Bearer MOCK_TOKEN`, "error", {
        fn: name, extra: { accessToken: "MOCK_ACCESS", customerEmail: "mock@example.invalid" },
      });
      return new Response("ok");
    })(new Request("https://mock.invalid/function", { headers: {
      "x-request-id": name, "sentry-trace": incoming,
    } }))));
    const response = await withCronMonitor("cron", "mock-cron", () => new Response("retry", { status: 503 }),
      { schedule: { type: "interval", value: 1, unit: "hour" } })(new Request("https://mock.invalid/cron"));
    assertEquals(response.status, 503);
    await assertRejects(() => wrapEdgeHandler("throws", () => { throw new Error("MOCK_BUG"); })(
      new Request("https://mock.invalid/throws")), Error, "MOCK_BUG");
    await sdk.flush(2000);
    const json = envelopes.join("\n");
    assert(!/mock@example.invalid|XAXX010101000|MOCK_TOKEN|MOCK_ACCESS/.test(json));
    assert(json.includes("libre-carga-edge@mock-contract"));
    assert(json.includes('"status":"in_progress"') && json.includes('"status":"error"'));
    const events = envelopes.flatMap((text) => text.split("\n").filter((line) => line.startsWith("{"))
      .flatMap((line) => { try { return [JSON.parse(line)]; } catch { return []; } }));
    for (const name of ["alpha", "beta"]) {
      const event = events.find((item) => item.message?.startsWith(`${name}:`));
      assert(event, `missing ${name} event`);
      assertEquals(event.tags.fn, name);
      assertEquals(event.tags.request_id, name);
      assertEquals(event.contexts.trace.trace_id, "0123456789abcdef0123456789abcdef");
      const transaction = events.find((item) => item.type === "transaction" && item.transaction === name);
      assert(transaction, `missing ${name} transaction`);
      assertEquals(transaction.tags.fn, name);
      assertEquals(transaction.tags.request_id, name);
      assertEquals(transaction.contexts.trace.trace_id, event.contexts.trace.trace_id);
    }
    const privacySpan = sdk.startInactiveSpan({ name: "Bearer MOCK_SPAN", attributes: {
      customerEmail: "mock@example.invalid", note: "RFC XAXX010101000", accessToken: "MOCK_ACCESS",
    } });
    privacySpan.end();
    await sdk.flush(2000);
    const privacyJson = envelopes.join("\n");
    assert(!/MOCK_SPAN|mock@example.invalid|XAXX010101000|MOCK_ACCESS/.test(privacyJson),
      privacyJson.match(/.{0,70}(?:MOCK_SPAN|mock@example.invalid|XAXX010101000|MOCK_ACCESS).{0,70}/)?.[0]);
    assert(json.includes("http.server"));
    assert(json.includes("0123456789abcdef0123456789abcdef"));
    // The final monitor envelope must have reached transport before the wrapper returns.
    assert(envelopes.some((text) => text.includes('"status":"error"')));
  } finally {
    await sdk.close(2000);
    globalThis.fetch = fetchOriginal;
    for (const key of ["SENTRY_DSN_EDGE", "SENTRY_RELEASE_EDGE", "SENTRY_CRON_MONITOR_SLUG"]) Deno.env.delete(key);
  }
});
