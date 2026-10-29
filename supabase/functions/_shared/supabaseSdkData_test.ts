/** Real PostgREST/Storage SDK contracts with a private in-memory transport. */
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { FakeTime } from "https://deno.land/std@0.224.0/testing/time.ts";
import { createClient, jsonResponse, offlineTest, SDK_KEY, SDK_URL, sdkFixture, USER_ID } from "./supabaseSdkContract.ts";
import { fetchOrgSlug } from "./orgSlug.ts";
import { fakeRealtimeTransport, settleRealtime } from "./supabaseRealtimeContract.ts";
import { facturapiResolverClient } from "./facturapiAuth.ts";

offlineTest("Supabase SDK: the credential query port preserves tenant/RPC inputs and rejects malformed RPC data", async () => {
  const row = {
    ambiente: "sandbox", api_key_sandbox_secret_name: null, api_key_live_secret_name: null,
    api_key_sandbox_vault_id: "contract-vault", api_key_live_vault_id: null, facturapi_org_id: "contract-org",
  };
  const { client, requests } = sdkFixture((request) => jsonResponse(
    request.url.pathname.includes("/rpc/") ? "contract-vault-key" : [row],
  ));
  const port = facturapiResolverClient(client);
  const loaded = await port.from("facturapi_credenciales")
    .select("ambiente, api_key_sandbox_secret_name, api_key_live_secret_name, api_key_sandbox_vault_id, api_key_live_vault_id, facturapi_org_id")
    .eq("organization_id", USER_ID).maybeSingle();
  assertEquals(loaded.data, row);
  assertEquals(requests[0].url.pathname, "/rest/v1/facturapi_credenciales");
  assertEquals(requests[0].url.searchParams.get("organization_id"), `eq.${USER_ID}`);
  assert(port.rpc);
  const args = { p_org_id: USER_ID, p_ambiente: "sandbox" };
  assertEquals(await port.rpc("get_facturapi_api_key_internal", args), { data: "contract-vault-key", error: null });
  assertEquals(requests[1].url.pathname, "/rest/v1/rpc/get_facturapi_api_key_internal");
  assertEquals(JSON.parse(requests[1].body), args);
  const invalid = sdkFixture(() => jsonResponse({ unexpected: "not-a-key" }));
  const invalidPort = facturapiResolverClient(invalid.client);
  assert(invalidPort.rpc);
  assertEquals(await invalidPort.rpc("get_facturapi_api_key_internal", args), { data: null, error: null });
  const denied = sdkFixture(() => jsonResponse({ code: "42501", message: "denied" }, 403));
  const deniedPort = facturapiResolverClient(denied.client);
  assert(deniedPort.rpc);
  const failure = await deniedPort.rpc("get_facturapi_api_key_internal", args);
  assertEquals(failure.data, null);
  assert(typeof failure.error === "object" && failure.error !== null && "code" in failure.error);
  assertEquals(failure.error.code, "42501");
});

offlineTest("Supabase SDK: the organization-name helper accepts the real generic client", async () => {
  const { client, requests } = sdkFixture(() => jsonResponse([{ nombre: "Órg Equipo /42" }]));
  assertEquals(await fetchOrgSlug(client, USER_ID), "Org_Equipo_42");
  assertEquals(requests.length, 1);
  assertEquals(requests[0].url.pathname, "/rest/v1/organizations");
  assertEquals(requests[0].url.searchParams.get("select"), "nombre");
  assertEquals(requests[0].url.searchParams.get("id"), `eq.${USER_ID}`);
});

offlineTest("Supabase SDK: organization-name responses are validated before slugification", async () => {
  for (const response of [
    null, [], [{}], [{ nombre: null }], [{ nombre: 42 }], [{ nombre: ["unexpected"] }],
    "unexpected-row", [{ nombre: "" }],
  ]) {
    const { client, requests } = sdkFixture(() => jsonResponse(response));
    assertEquals(await fetchOrgSlug(client, USER_ID), "org", JSON.stringify(response));
    assertEquals(requests.length, 1);
  }
});

offlineTest("Supabase SDK: select preserves query escaping and caller authorization", async () => {
  const { client, requests } = sdkFixture(() => jsonResponse({ id: USER_ID, total: 42 }), {
    Authorization: "Bearer verified-caller",
  });
  const result = await client.from("invoices").select("id,total")
    .eq("organization_id", USER_ID).eq("reference", "A&B /42").single();
  assertEquals(result.error, null);
  assertEquals(result.data, { id: USER_ID, total: 42 });
  assertEquals(requests.length, 1);
  const [request] = requests;
  assertEquals(request.url.origin, SDK_URL);
  assertEquals(request.url.pathname, "/rest/v1/invoices");
  assertEquals(request.url.searchParams.get("select"), "id,total");
  assertEquals(request.url.searchParams.get("organization_id"), `eq.${USER_ID}`);
  assertEquals(request.url.searchParams.get("reference"), "eq.A&B /42");
  assertEquals(request.url.searchParams.size, 3);
  assertEquals(request.method, "GET");
  assertEquals(request.headers.get("Authorization"), "Bearer verified-caller");
  assertEquals(request.headers.get("apikey"), SDK_KEY);
  assertEquals(request.headers.get("Accept"), "application/vnd.pgrst.object+json");
});

offlineTest("Supabase SDK: RPC preserves the POST envelope and service authorization", async () => {
  const { client, requests } = sdkFixture(() => jsonResponse({ allowed: true }));
  const args = { p_key: "contract-rate-limit", p_limit: 5 };
  const result = await client.rpc("check_ratelimit", args);
  assertEquals(result.error, null);
  assertEquals(result.data, { allowed: true });
  assertEquals(requests.length, 1);
  const [request] = requests;
  assertEquals(request.url.pathname, "/rest/v1/rpc/check_ratelimit");
  assertEquals(request.url.search, "");
  assertEquals(request.method, "POST");
  assertEquals(JSON.parse(request.body), args);
  assertEquals(request.headers.get("Authorization"), `Bearer ${SDK_KEY}`);
  assertEquals(request.headers.get("apikey"), SDK_KEY);
  assertEquals(request.headers.get("Content-Type"), "application/json");
});

offlineTest("Supabase SDK: PostgREST errors retain code/status without successful data", async () => {
  const { client, requests } = sdkFixture(() => jsonResponse({
    code: "PGRST116", message: "not found", details: "zero rows", hint: null,
  }, 404));
  const result = await client.from("invoices").select("id").single();
  assertEquals(result.data, null);
  assertEquals(result.status, 404);
  assertEquals(result.error?.code, "PGRST116");
  assertEquals(result.error?.message, "not found");
  assertEquals(requests.length, 1);
});

offlineTest("Supabase SDK: Storage upload preserves bytes, type and object path", async () => {
  const objectPath = "org-42/invoice 42.xml";
  const { client, requests } = sdkFixture(() => jsonResponse({
    Key: `invoices/${objectPath}`, Id: "contract-object",
  }));
  const result = await client.storage.from("invoices").upload(
    objectPath, new TextEncoder().encode("<invoice total='42'/>"),
    { contentType: "application/xml", upsert: false },
  );
  assertEquals(result.error, null);
  assertEquals(result.data?.path, objectPath);
  assertEquals(result.data?.fullPath, `invoices/${objectPath}`);
  assertEquals(requests.length, 1);
  const [request] = requests;
  assertEquals(request.url.pathname, "/storage/v1/object/invoices/org-42/invoice%2042.xml");
  assertEquals(request.method, "POST");
  assertEquals(request.body, "<invoice total='42'/>");
  assertEquals(request.headers.get("Content-Type"), "application/xml");
  assertEquals(request.headers.get("x-upsert"), "false");
  assertEquals(request.headers.get("Authorization"), `Bearer ${SDK_KEY}`);
  assertEquals(request.headers.get("apikey"), SDK_KEY);
});

offlineTest("Supabase SDK: signed URLs preserve expiration and encoded object path", async () => {
  // Storage returns the raw signed path; the SDK applies encodeURI to it.
  const signed = "/object/sign/invoices/org-42/invoice 42.xml?token=opaque";
  const { client, requests } = sdkFixture(() => jsonResponse({ signedURL: signed }));
  const result = await client.storage.from("invoices").createSignedUrl("org-42/invoice 42.xml", 60);
  assertEquals(result.error, null);
  assertEquals(result.data?.signedUrl, `${SDK_URL}/storage/v1/object/sign/invoices/org-42/invoice%2042.xml?token=opaque`);
  assertEquals(requests.length, 1);
  const [request] = requests;
  assertEquals(request.url.pathname, "/storage/v1/object/sign/invoices/org-42/invoice%2042.xml");
  assertEquals(request.method, "POST");
  assertEquals(JSON.parse(request.body), { expiresIn: 60 });
  assertEquals(request.headers.get("apikey"), SDK_KEY);
});

offlineTest("Supabase SDK: Realtime joins, scopes auth and removes its supplied transport", async () => {
  // Virtual timers keep Phoenix heartbeat/fallback timers test-local. Real SDK
  // channel and socket teardown must still pass before the timer scope closes.
  using clock = new FakeTime();
  const { sockets, FixtureWebSocket } = fakeRealtimeTransport();
  let currentToken = "contract-realtime-token";
  const client = createClient(SDK_URL, SDK_KEY, {
    accessToken: () => Promise.resolve(currentToken),
    global: { fetch: () => { throw new Error("Realtime socket contract must not use HTTP"); } },
    realtime: {
      transport: FixtureWebSocket, timeout: 1000, disconnectOnEmptyChannelsAfterMs: 0,
      params: { fixture: "scoped-channel" },
    },
  });
  const changes = { event: "*" as const, schema: "public", table: "invoices", filter: `organization_id=eq.${USER_ID}` };
  const statuses: string[] = [];
  const broadcasts: unknown[] = [];
  try {
    await client.realtime.setAuth(currentToken);
    const channel = client.channel("invoice-contract", { config: { private: true } })
      .on("postgres_changes", changes, () => {})
      .on("broadcast", { event: "invoice.updated" }, (event) => broadcasts.push(event.payload))
      .subscribe((status) => statuses.push(status));
    assertEquals(sockets.length, 1);
    const [socket] = sockets;
    const address = new URL(socket.url);
    assertEquals(address.origin, SDK_URL.replace("https:", "wss:"));
    assertEquals(address.pathname, "/realtime/v1/websocket");
    assertEquals(address.searchParams.get("apikey"), SDK_KEY);
    assertEquals(address.searchParams.get("vsn"), "2.0.0");
    assertEquals(address.searchParams.get("fixture"), "scoped-channel");
    assertEquals(address.searchParams.has("access_token"), false);
    socket.open();
    await settleRealtime();
    const join = socket.sent.find((frame) => frame[3] === "phx_join");
    assert(join);
    assertEquals(join[2], "realtime:invoice-contract");
    assertEquals(join[4].access_token, currentToken);
    assertEquals(join[4].config?.private, true);
    assertEquals(join[4].config?.postgres_changes, [changes]);
    socket.reply(join, { postgres_changes: [{ ...changes, id: 17 }] });
    await settleRealtime();
    assert(statuses.includes("SUBSCRIBED"));
    assertEquals(client.getChannels(), [channel]);
    socket.receive([join[0], null, join[2], "broadcast", {
      event: "invoice.updated", payload: { id: USER_ID, total: 42 },
    }]);
    assertEquals(broadcasts, [{ id: USER_ID, total: 42 }]);
    currentToken = "contract-refreshed-token";
    await client.realtime.setAuth(currentToken);
    const refreshed = socket.sent.findLast((frame) => frame[3] === "access_token");
    assert(refreshed);
    assertEquals(refreshed[2], join[2]);
    assertEquals(refreshed[4], { access_token: currentToken });
    const removing = client.removeChannel(channel);
    await settleRealtime();
    const leave = socket.sent.findLast((frame) => frame[3] === "phx_leave");
    assert(leave);
    assertEquals(leave[2], join[2]);
    socket.reply(leave);
    assertEquals(await removing, "ok");
    await settleRealtime();
    clock.tick(11000);
    await settleRealtime();
    assertEquals(client.getChannels(), []);
    assert(statuses.includes("CLOSED"));
    assertEquals(socket.closeCalls, 1);
    assertEquals(socket.readyState, socket.CLOSED);
    assertEquals(client.realtime.isConnected(), false);
    assertEquals(sockets.length, 1);
    assertEquals(clock.next(), false, "Cleanup must leave no pending Phoenix timer");
  } finally {
    await client.realtime.disconnect();
  }
});
