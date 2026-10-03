import { scrubTelemetryData, scrubTelemetryText } from "./scrubTelemetryData.ts";

export type SentryEdgeSDK = typeof import("npm:@sentry/deno@10.76.0");
let ready: Promise<SentryEdgeSDK | null> | null = null;

/** SDK-generated trace identity is opaque, not a phone number or credential. */
function scrubContexts<T extends Record<string, unknown> | undefined>(contexts: T): T {
  const clean = scrubTelemetryData(contexts) as T;
  const trace = contexts?.trace as Record<string, unknown> | undefined;
  const cleanTrace = clean?.trace as Record<string, unknown> | undefined;
  if (trace && cleanTrace) {
    for (const key of ["trace_id", "span_id", "parent_span_id"]) {
      const value = trace[key];
      const pattern = key === "trace_id" ? /^[a-f0-9]{32}$/i : /^[a-f0-9]{16}$/i;
      if (typeof value === "string" && pattern.test(value)) cleanTrace[key] = value;
    }
  }
  return clean;
}

/** Exact SDK version; one initialized client per isolate, no secret in logs. */
export function loadSentryEdge(): Promise<SentryEdgeSDK | null> {
  if (!Deno.env.get("SENTRY_DSN_EDGE")) return Promise.resolve(null);
  if (!ready) {
    ready = import("npm:@sentry/deno@10.76.0").then((sdk) => {
      const build = Deno.env.get("SENTRY_RELEASE_EDGE") ?? Deno.env.get("DENO_DEPLOYMENT_ID") ?? "unversioned";
      sdk.init({
        dsn: Deno.env.get("SENTRY_DSN_EDGE"),
        environment: Deno.env.get("DENO_ENV") ?? Deno.env.get("SUPABASE_ENV") ?? "production",
        release: `libre-carga-edge@${build}`,
        tracesSampleRate: 0.1,
        traceLifecycle: "static",
        // Manual scoped reporting: don't monkey-patch Supabase's shared runtime.
        defaultIntegrations: false,
        skipOpenTelemetrySetup: true,
        sendDefaultPii: false,
        dataCollection: { userInfo: false, cookies: false, httpHeaders: false,
          httpBodies: [], urlQueryParams: false, genAI: { inputs: false, outputs: false },
          databaseQueryData: false, graphQL: { document: false, variables: false } },
        beforeSend(event) {
          if (event.message) event.message = scrubTelemetryText(event.message);
          for (const value of event.exception?.values ?? []) {
            if (value.value) value.value = scrubTelemetryText(value.value);
          }
          event.extra = scrubTelemetryData(event.extra) as typeof event.extra;
          event.contexts = scrubContexts(event.contexts);
          event.tags = scrubTelemetryData(event.tags) as typeof event.tags;
          if (event.user) event.user = { id: event.user.id };
          return event;
        },
        beforeSendSpan(span) {
          if (span.description) span.description = scrubTelemetryText(span.description);
          span.data = scrubTelemetryData(span.data) as typeof span.data;
          if (span.links) span.links = span.links.map((link) => ({
            ...link, attributes: scrubTelemetryData(link.attributes) as typeof link.attributes,
          }));
          return span;
        },
        // SDK 10 sends the root span as a transaction, not a streamed span.
        beforeSendTransaction(event) {
          if (event.transaction) event.transaction = scrubTelemetryText(event.transaction);
          const sampling = event.sdkProcessingMetadata?.dynamicSamplingContext;
          if (sampling && typeof sampling.transaction === "string") {
            sampling.transaction = scrubTelemetryText(sampling.transaction);
          }
          event.extra = scrubTelemetryData(event.extra) as typeof event.extra;
          event.contexts = scrubContexts(event.contexts);
          event.tags = scrubTelemetryData(event.tags) as typeof event.tags;
          if (event.user) event.user = { id: event.user.id };
          return event;
        },
      });
      sdk.setTag("runtime", "deno-edge");
      sdk.setTag("release_versioned", String(build !== "unversioned"));
      return sdk;
    }).catch(() => {
      ready = null;
      console.warn("[sentry-edge] initialization failed");
      return null;
    });
  }
  return ready;
}
