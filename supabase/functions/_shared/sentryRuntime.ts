import { scrubTelemetryData, scrubTelemetryText } from "./scrubTelemetryData.ts";

export type SentryEdgeSDK = typeof import("npm:@sentry/deno@11.4.0");
let ready: Promise<SentryEdgeSDK | null> | null = null;

/** Exact SDK version; one initialized client per isolate, no secret in logs. */
export function loadSentryEdge(): Promise<SentryEdgeSDK | null> {
  if (!Deno.env.get("SENTRY_DSN_EDGE")) return Promise.resolve(null);
  if (!ready) {
    ready = import("npm:@sentry/deno@11.4.0").then((sdk) => {
      const build = Deno.env.get("SENTRY_RELEASE_EDGE") ?? Deno.env.get("DENO_DEPLOYMENT_ID") ?? "unversioned";
      sdk.init({
        dsn: Deno.env.get("SENTRY_DSN_EDGE"),
        environment: Deno.env.get("DENO_ENV") ?? Deno.env.get("SUPABASE_ENV") ?? "production",
        release: `libre-carga-edge@${build}`,
        tracesSampleRate: 0.1,
        // Manual scoped reporting: don't monkey-patch Supabase's shared runtime.
        defaultIntegrations: false,
        dataCollection: { userInfo: false, cookies: false, httpHeaders: false,
          httpBodies: [], urlQueryParams: false, genAI: { inputs: false, outputs: false },
          databaseQueryData: false, queues: false, graphQL: { document: false, variables: false } },
        beforeSend(event) {
          if (event.message) event.message = scrubTelemetryText(event.message);
          for (const value of event.exception?.values ?? []) {
            if (value.value) value.value = scrubTelemetryText(value.value);
          }
          event.extra = scrubTelemetryData(event.extra) as typeof event.extra;
          event.contexts = scrubTelemetryData(event.contexts) as typeof event.contexts;
          event.tags = scrubTelemetryData(event.tags) as typeof event.tags;
          if (event.user) event.user = { id: event.user.id };
          return event;
        },
        beforeSendSpan(span) {
          span.name = scrubTelemetryText(span.name);
          span.attributes = scrubTelemetryData(span.attributes) as typeof span.attributes;
          if (span.links) span.links = span.links.map((link) => ({
            ...link, attributes: scrubTelemetryData(link.attributes) as typeof link.attributes,
          }));
          return span;
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
