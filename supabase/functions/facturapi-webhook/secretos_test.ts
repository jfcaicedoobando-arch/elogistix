/**
 * Corrección P2 · Aislamiento Sandbox/Live en el runtime del webhook.
 *
 * El endpoint acepta UN solo secret: el del ambiente activo de la credencial o
 * el del ambiente declarado en la URL aislada (`&amb=`). Nunca el opuesto.
 */
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { ambienteDeUrl, secretosDeCredencial } from "./secretos.ts";

const u = (qs: string) => new URL(`https://p.supabase.co/functions/v1/facturapi-webhook${qs}`);

Deno.test("ambienteDeUrl: sin &amb manda el ambiente activo; un valor raro es inválido", () => {
  assertEquals(ambienteDeUrl(u("?org=o1")), null);
  assertEquals(ambienteDeUrl(u("?org=o1&amb=")), null);
  assertEquals(ambienteDeUrl(u("?org=o1&amb=sandbox")), "sandbox");
  assertEquals(ambienteDeUrl(u("?org=o1&amb=live")), "live");
  assertEquals(ambienteDeUrl(u("?org=o1&amb=produccion")), "invalido");
});

Deno.test("una firma Sandbox se rechaza cuando la organización está en Live", () => {
  const row = { ambiente: "live", webhook_secret_sandbox: "s-sbx", webhook_secret_live: "s-live" };
  // Sin &amb manda Live: el secret de Sandbox no se prueba nunca.
  const activos = secretosDeCredencial(row, null);
  assertEquals(activos, [{ secret: "s-live", origen: "live" }]);
  assert(!activos.some((s) => s.secret === "s-sbx"));
  // Con la URL aislada de Sandbox sí se usa el de Sandbox, y sólo ése.
  assertEquals(secretosDeCredencial(row, "sandbox"), [{ secret: "s-sbx", origen: "sandbox" }]);
});

Deno.test("una firma Live se rechaza cuando la organización está en Sandbox", () => {
  const row = { ambiente: "sandbox", webhook_secret_sandbox: "s-sbx", webhook_secret_live: "s-live" };
  assertEquals(secretosDeCredencial(row, null), [{ secret: "s-sbx", origen: "sandbox" }]);
});

Deno.test("el ambiente pedido sin su propio secret es fail-closed", () => {
  const row = { ambiente: "live", webhook_secret_sandbox: "s-sbx", webhook_secret: "legado" };
  assertEquals(secretosDeCredencial(row, "live"), []);
});

Deno.test("el secret legado necesita ventana vigente y ningún secret por ambiente", () => {
  const legado = { ambiente: "sandbox", webhook_secret: "legado" };
  Deno.env.delete("FACTURAPI_WEBHOOK_LEGACY_HASTA");
  assertEquals(secretosDeCredencial(legado, null), []);
  Deno.env.set("FACTURAPI_WEBHOOK_LEGACY_HASTA", new Date(Date.now() + 3_600_000).toISOString());
  try {
    assertEquals(secretosDeCredencial(legado, null), [{ secret: "legado", origen: "legacy" }]);
    // Con secret por ambiente, el legado deja de aceptarse aunque haya ventana.
    assertEquals(
      secretosDeCredencial({ ...legado, webhook_secret_sandbox: "s-sbx" }, null),
      [{ secret: "s-sbx", origen: "sandbox" }],
    );
  } finally {
    Deno.env.delete("FACTURAPI_WEBHOOK_LEGACY_HASTA");
  }
});

Deno.test("index.ts valida el &amb antes de resolver secretos", async () => {
  const src = await Deno.readTextFile(new URL("./index.ts", import.meta.url));
  assert(src.includes("ambienteDeUrl(url)"), "el handler debe leer el ambiente aislado de la URL");
  assert(src.includes("ambiente_invalido"), "un &amb desconocido debe rechazarse");
  assert(
    src.includes("secretosDeCredencial(cred, ambienteUrl)"),
    "la firma debe validarse contra el secret del ambiente resuelto",
  );
});
