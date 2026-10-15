import { ok as assert, deepStrictEqual as assertEquals } from "node:assert/strict";
import { corsHeaders } from "../_shared/cors.ts";
import { createDemoAccessHandler, type DemoAdminClient, type DemoProbeClient, type DemoCredentials } from "./handler.ts";
import type { DemoAvailabilityProvider } from "./availability.ts";

const ACTOR = "de200000-0000-0000-0000-000000000001";
const unavailable = { error: "demo_unavailable" };

function harness(options: {
  provider?: DemoAvailabilityProvider;
  existing?: boolean;
  passwordValid?: boolean;
  limitAt?: number;
  limitErrorAt?: number;
  withoutCredentials?: boolean;
  credentials?: DemoCredentials;
} = {}) {
  const credentials = options.credentials ?? {
    email: crypto.randomUUID() + "@example.invalid",
    password: crypto.randomUUID(),
  };
  const events: string[] = [];
  const rpcCalls: Array<{ name: string; args: unknown }> = [];
  let limitCalls = 0;
  const admin: DemoAdminClient = {
    auth: {
      admin: {
        listUsers: () => {
          events.push("auth.listUsers");
          return Promise.resolve({ data: { users: options.existing === false ? [] : [{
            id: ACTOR, email: credentials.email, email_confirmed_at: "2026-01-01",
          }] }, error: null });
        },
        createUser: () => {
          events.push("auth.createUser");
          return Promise.resolve({ data: { user: { id: ACTOR } }, error: null });
        },
        updateUserById: () => {
          events.push("auth.updateUserById");
          return Promise.resolve({ error: null });
        },
      },
    },
    rpc: (name: string, args: unknown) => {
      events.push("rpc." + name);
      rpcCalls.push({ name, args });
      if (name === "check_ratelimit") {
        limitCalls++;
        if (limitCalls === options.limitErrorAt) {
          return Promise.resolve({ data: null, error: { message: "synthetic rate limit failure" } });
        }
        return Promise.resolve({ data: { ok: limitCalls !== options.limitAt, retry_after: 42 }, error: null });
      }
      return Promise.resolve({ data: true, error: null });
    },
  };
  const probe: DemoProbeClient = {
    auth: {
      signInWithPassword: () => {
        events.push("auth.probeSignIn");
        return Promise.resolve({ error: options.passwordValid === false ? new Error("synthetic invalid password") : null });
      },
      signOut: () => { events.push("auth.probeSignOut"); return Promise.resolve(); },
    },
  };
  const handler = createDemoAccessHandler({
    availabilityProvider: options.provider,
    credentials: options.withoutCredentials ? undefined : credentials,
    createAdminClient: () => { events.push("createAdmin"); return admin; },
    createProbeClient: () => { events.push("createProbe"); return probe; },
    captureException: () => { events.push("telemetry"); return Promise.resolve(); },
  });
  return { handler, events, rpcCalls, credentials };
}

function hostileRequest(origin?: string): Request {
  return new Request("https://fixture.invalid/demo-access?available=true&state=active&actor=forged&run=forged&organization_id=forged", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-demo-available": "true", "x-demo-state": "active",
      "x-user-id": "forged", "x-run-id": "forged", "x-organization-id": "forged",
      "Authorization": "Bearer " + crypto.randomUUID(),
      "x-demo-email": crypto.randomUUID() + "@example.invalid",
      "x-demo-password": crypto.randomUUID(),
      ...(origin ? { origin } : {}),
    },
    body: JSON.stringify({ available: true, state: "active", actor: "forged", run: "forged", organization_id: "forged",
      credentials: { email: crypto.randomUUID() + "@example.invalid", password: crypto.randomUUID() } }),
  });
}

const rejectedDecisions: Array<[string, DemoAvailabilityProvider | undefined]> = [
  ["missing provider", undefined],
  ["false", () => Promise.resolve(false)],
  ["bare true is invalid", () => Promise.resolve(true)],
  ["null", () => Promise.resolve(null)],
  ["undefined", () => Promise.resolve(undefined)],
  ["empty object", () => Promise.resolve({})],
  ["string boolean", () => Promise.resolve({ available: "true", state: "active" })],
  ["missing state", () => Promise.resolve({ available: true })],
  ["inactive state", () => Promise.resolve({ available: true, state: "inactive" })],
  ["not available", () => Promise.resolve({ available: false, state: "active" })],
  ["unknown state", () => Promise.resolve({ available: true, state: "ready" })],
  ["array", () => Promise.resolve([{ available: true, state: "active" }])],
  ["inherited decision", () => Promise.resolve(Object.create({ available: true, state: "active" }))],
  ["accessor decision", () => Promise.resolve({ get available() { throw new Error("private provider detail"); }, state: "active" })],
  ["foreign actor field", () => Promise.resolve({ available: true, state: "active", actor: "forged" })],
  ["foreign run field", () => Promise.resolve({ available: true, state: "active", run: "forged" })],
  ["foreign organization field", () => Promise.resolve({ available: true, state: "active", organization_id: "forged" })],
  ["provider throws", () => { throw new Error("private provider detail, credentials, organization"); }],
  ["provider rejects", () => Promise.reject(new Error("private provider detail"))],
];

for (const [label, provider] of rejectedDecisions) {
  Deno.test("demo availability: " + label + " returns 503 before ALL client/Auth/SQL effects", async () => {
    const { handler, events, rpcCalls } = harness({ provider });
    const req = hostileRequest("https://foreign.fixture.invalid");
    const response = await handler(req);
    assertEquals(response.status, 503);
    assertEquals(await response.json(), unavailable);
    assertEquals(response.headers.get("Retry-After"), "30");
    assertEquals(response.headers.get("Cache-Control"), "no-store");
    assertEquals(response.headers.get("Access-Control-Allow-Origin"), corsHeaders["Access-Control-Allow-Origin"]);
    assertEquals(events, []); // Includes list/reset/create/sign-in/sign-out/membership/seed.
    assertEquals(rpcCalls, []); // Also no rate-limit SQL when availability is closed.
    assertEquals(req.bodyUsed, false); // Body cannot supply availability/actor/run/org.
  });
}

Deno.test("demo availability: OPTIONS remains first, without provider or backend calls", async () => {
  let providerCalls = 0;
  const { handler, events, rpcCalls } = harness({ provider: () => {
    providerCalls++; throw new Error("must not inspect availability during preflight");
  } });
  const response = await handler(new Request("https://fixture.invalid/demo-access", { method: "OPTIONS", headers: { origin: "https://foreign.fixture.invalid" } }));
  assertEquals(response.status, 200);
  assertEquals(await response.text(), "ok");
  for (const [name, value] of Object.entries(corsHeaders)) assertEquals(response.headers.get(name), value);
  assertEquals(providerCalls, 0);
  assertEquals(events, []);
  assertEquals(rpcCalls, []);
});

for (const origin of [undefined, "https://librecarga.com", "https://foreign.fixture.invalid"]) {
  Deno.test("demo availability: request origin cannot enable missing provider: " + origin, async () => {
    const { handler, events } = harness();
    const response = await handler(hostileRequest(origin));
    assertEquals(response.status, 503);
    assertEquals(await response.json(), unavailable);
    assertEquals(response.headers.get("Access-Control-Allow-Origin"), "*"); // Exact public contract in cd2a974e.
    assertEquals(events, []);
  });
}

Deno.test("demo availability: await the server decision before constructing either client", async () => {
  let finish: (value: unknown) => void = () => { throw new Error("provider not started"); };
  const { handler, events } = harness({ provider: () => new Promise((resolve) => { finish = resolve; }) });
  const pending = handler(hostileRequest());
  await Promise.resolve();
  assertEquals(events, []);
  finish({ available: false, state: "inactive" });
  const response = await pending;
  assertEquals(response.status, 503);
  await response.body?.cancel();
  assertEquals(events, []);
});

// Positive test dependency only. The production adapter does NOT wire this.
const syntheticActive = () => Promise.resolve({ available: true, state: "active" });

for (const step of [1, 2]) {
  Deno.test("demo availability: preserve rate-limit rejection at step " + step, async () => {
    const { handler, events, rpcCalls } = harness({ provider: syntheticActive, limitAt: step });
    const response = await handler(hostileRequest());
    assertEquals(response.status, 429);
    assertEquals(await response.json(), { error: "rate_limited" });
    assertEquals(response.headers.get("Retry-After"), "42");
    assertEquals(events, ["createAdmin", ...Array(step).fill("rpc.check_ratelimit")]);
    assertEquals(rpcCalls.length, step);
  });
  Deno.test("demo availability: preserve rate-limit fail-closed error at step " + step, async () => {
    const { handler, events } = harness({ provider: syntheticActive, limitErrorAt: step });
    const response = await handler(hostileRequest());
    assertEquals(response.status, 503);
    assertEquals(await response.json(), { error: "rate_limit_unavailable" });
    assertEquals(events, ["createAdmin", ...Array(step).fill("rpc.check_ratelimit"), "telemetry"]);
  });
}

for (const mode of ["existing", "reset", "create"] as const) {
  Deno.test("demo availability: trusted synthetic active decision precedes unchanged " + mode + " flow", async () => {
    const providerArgs: unknown[][] = [];
    const provider: DemoAvailabilityProvider = (...args: unknown[]) => {
      providerArgs.push(args); return syntheticActive();
    };
    const { handler, events, rpcCalls, credentials } = harness({ provider, existing: mode !== "create", passwordValid: mode !== "reset" });
    const req = hostileRequest();
    const response = await handler(req);
    assertEquals(response.status, 200);
    const body = await response.json();
    assertEquals(body.email, credentials.email);
    assertEquals(body.password, credentials.password);
    assertEquals(providerArgs, [[]]); // No Request, actor, run, organization or headers.
    assertEquals(events, ["createAdmin", "rpc.check_ratelimit", "rpc.check_ratelimit", "auth.listUsers",
      ...(mode === "create" ? ["auth.createUser"] : ["createProbe", "auth.probeSignIn", "auth.probeSignOut", ...(mode === "reset" ? ["auth.updateUserById"] : [])]),
      "rpc.ensure_demo_membership", "rpc.seed_demo_organization_guarded"]);
    assertEquals(rpcCalls, [
      { name: "check_ratelimit", args: { p_key: "demo-access:unknown", p_window_seconds: 60, p_max: 5 } },
      { name: "check_ratelimit", args: { p_key: "demo-access:global", p_window_seconds: 3600, p_max: 30 } },
      { name: "ensure_demo_membership", args: { _user_id: ACTOR } },
      { name: "seed_demo_organization_guarded", args: { p_skip_ms: 600000 } },
    ]);
    assertEquals(req.bodyUsed, false);
    assert(!events.includes("ERROR.adminSignIn"));
  });
}


Deno.test("demo credentials: active availability without credentials stays closed before every effect", async () => {
  const { handler, events, rpcCalls } = harness({ provider: syntheticActive, withoutCredentials: true });
  const req = hostileRequest();
  const response = await handler(req);
  assertEquals(response.status, 503);
  assertEquals(await response.json(), unavailable);
  assertEquals(response.headers.get("Retry-After"), "30");
  assertEquals(response.headers.get("Cache-Control"), "no-store");
  assertEquals(events, []);
  assertEquals(rpcCalls, []);
  assertEquals(req.bodyUsed, false);
});

for (const field of ["email", "password"] as const) {
  for (const empty of ["", " "]) {
    Deno.test("demo credentials: empty " + field + " remains unavailable", async () => {
      const credentials = { email: crypto.randomUUID() + "@example.invalid", password: crypto.randomUUID(), [field]: empty };
      const { handler, events, rpcCalls } = harness({ provider: syntheticActive, credentials });
      const response = await handler(hostileRequest());
      assertEquals(response.status, 503);
      assertEquals(await response.json(), unavailable);
      assertEquals(events, []);
      assertEquals(rpcCalls, []);
    });
  }
}
