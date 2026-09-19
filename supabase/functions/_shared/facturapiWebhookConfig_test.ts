/**
 * P2-A · Pruebas de la configuración de webhooks por ambiente.
 */
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  ambienteDeCredencial,
  compararConfigRemota,
  elegirWebhookRemoto,
  EVENTOS_REQUERIDOS,
  patchVerificacion,
  resolverSecretosWebhook,
  secretPorAmbiente,
  tieneSecretPorAmbiente,
  urlWebhookEsperada,

} from "./facturapiWebhookConfig.ts";

const URL_ESPERADA = urlWebhookEsperada("https://proj.supabase.co", "org-1");

Deno.test("la URL esperada incluye ?org y no duplica slashes", () => {
  assertEquals(URL_ESPERADA, "https://proj.supabase.co/functions/v1/facturapi-webhook?org=org-1");
  assertEquals(urlWebhookEsperada("https://proj.supabase.co/", "org-1"), URL_ESPERADA);
});

const FUTURO = new Date(Date.now() + 86_400_000).toISOString();
const PASADO = new Date(Date.now() - 86_400_000).toISOString();

Deno.test("la URL aislada por ambiente agrega &amb=", () => {
  assertEquals(
    urlWebhookEsperada("https://proj.supabase.co", "org-1", "live"),
    `${URL_ESPERADA}&amb=live`,
  );
});

Deno.test("aislamiento: sólo se acepta el secret del ambiente activo", () => {
  const row = {
    ambiente: "live",
    webhook_secret_sandbox: "s-sbx",
    webhook_secret_live: "s-live",
    webhook_secret: "s-legacy",
  };
  assertEquals(ambienteDeCredencial(row), "live");
  // Una firma de Sandbox NO puede validar en una org Live: el único secret
  // aceptado es el de Live.
  assertEquals(resolverSecretosWebhook(row), [{ secret: "s-live", origen: "live" }]);
  // Y viceversa, cuando la URL aislada declara Sandbox.
  assertEquals(
    resolverSecretosWebhook(row, { ambienteSolicitado: "sandbox" }),
    [{ secret: "s-sbx", origen: "sandbox" }],
  );
});

Deno.test("org Live sin secret Live: fail-closed (no cae al de Sandbox ni al legado)", () => {
  const row = { ambiente: "live", webhook_secret_sandbox: "s-sbx", webhook_secret: "s-legacy" };
  assertEquals(resolverSecretosWebhook(row, { legacyHasta: FUTURO }), []);
  const soloSandbox = { ambiente: "sandbox", webhook_secret_live: "s-live", webhook_secret: "viejo" };
  assertEquals(resolverSecretosWebhook(soloSandbox, { legacyHasta: FUTURO }), []);
});

Deno.test("el secret legado exige ventana de compatibilidad vigente y ningún secret por ambiente", () => {
  const legado = { ambiente: "sandbox", webhook_secret: "viejo" };
  assertEquals(resolverSecretosWebhook(legado, { legacyHasta: FUTURO }), [
    { secret: "viejo", origen: "legacy" },
  ]);
  // Sin ventana, o con ventana expirada, el legado no se acepta.
  assertEquals(resolverSecretosWebhook(legado), []);
  assertEquals(resolverSecretosWebhook(legado, { legacyHasta: PASADO }), []);
  assertEquals(resolverSecretosWebhook(legado, { legacyHasta: "no-es-fecha" }), []);
  // Con secret por ambiente el legado nunca se prueba.
  assertEquals(
    resolverSecretosWebhook(
      { ambiente: "sandbox", webhook_secret: "viejo", webhook_secret_sandbox: "nuevo" },
      { legacyHasta: FUTURO },
    ),
    [{ secret: "nuevo", origen: "sandbox" }],
  );
  assertEquals(resolverSecretosWebhook(null, { legacyHasta: FUTURO }), []);
});

Deno.test("helpers de secret por ambiente", () => {
  assertEquals(secretPorAmbiente({ webhook_secret_live: "L" }, "live"), "L");
  assertEquals(secretPorAmbiente({ webhook_secret_live: "L" }, "sandbox"), null);
  assertEquals(tieneSecretPorAmbiente({ webhook_secret: "viejo" }), false);
  assertEquals(tieneSecretPorAmbiente({ webhook_secret_sandbox: "S" }), true);
  assertEquals(tieneSecretPorAmbiente(null), false);
});


Deno.test("diagnóstico ok cuando URL, estado y eventos coinciden", () => {
  const diag = compararConfigRemota({
    ambiente: "live",
    urlEsperada: URL_ESPERADA,
    secretConfigurado: true,
    secretLegado: false,
    remoto: { id: "wh_1", url: URL_ESPERADA, events: [...EVENTOS_REQUERIDOS], status: "active" },
  });
  assertEquals(diag.estado, "ok");
  assertEquals(diag.eventosFaltantes, []);
});

Deno.test("diagnóstico detecta URL distinta, eventos faltantes, inactivo y ausencia", () => {
  const base = { ambiente: "sandbox" as const, urlEsperada: URL_ESPERADA, secretConfigurado: true, secretLegado: false };
  assertEquals(
    compararConfigRemota({ ...base, remoto: { id: "w", url: "https://otro/hook", events: [...EVENTOS_REQUERIDOS] } }).estado,
    "url_distinta",
  );
  const faltantes = compararConfigRemota({
    ...base, remoto: { id: "w", url: URL_ESPERADA, events: ["invoice.status_updated"], status: "active" },
  });
  assertEquals(faltantes.estado, "eventos_faltantes");
  assert(faltantes.eventosFaltantes.includes("receipt.cancellation_status_updated"));
  assertEquals(
    compararConfigRemota({ ...base, remoto: { id: "w", url: URL_ESPERADA, events: [...EVENTOS_REQUERIDOS], status: "paused" } }).estado,
    "inactivo",
  );
  assertEquals(compararConfigRemota({ ...base, remoto: null }).estado, "no_encontrado");
  assertEquals(
    compararConfigRemota({ ...base, secretConfigurado: false, remoto: null }).estado,
    "no_configurado",
  );
});

Deno.test("el diagnóstico nunca contiene secretos", () => {
  const diag = compararConfigRemota({
    ambiente: "live",
    urlEsperada: URL_ESPERADA,
    secretConfigurado: true,
    secretLegado: true,
    remoto: { id: "wh_1", url: URL_ESPERADA, events: [...EVENTOS_REQUERIDOS], status: "active" },
  });
  const texto = JSON.stringify(diag).toLowerCase();
  assert(!texto.includes("secret\":\""), texto);
  assert(!texto.includes("s-live"));
  assertEquals(diag.secretLegado, true);
});

Deno.test("elegirWebhookRemoto prefiere la URL y cae al id guardado", () => {
  const remotos = [{ id: "a", url: "https://otro/hook" }, { id: "b", url: `${URL_ESPERADA}/` }];
  assertEquals(elegirWebhookRemoto(remotos, URL_ESPERADA)?.id, "b");
  assertEquals(elegirWebhookRemoto([{ id: "z" }], URL_ESPERADA, "z")?.id, "z");
  assertEquals(elegirWebhookRemoto([{ id: "z" }], URL_ESPERADA), null);
});

Deno.test("patchVerificacion escribe sólo columnas del ambiente verificado", () => {
  const diag = compararConfigRemota({
    ambiente: "sandbox",
    urlEsperada: URL_ESPERADA,
    secretConfigurado: true,
    secretLegado: false,
    remoto: { id: "wh_9", url: URL_ESPERADA, events: [...EVENTOS_REQUERIDOS], status: "active" },
  });
  const patch = patchVerificacion(diag);
  assertEquals(patch.webhook_estado_sandbox, "ok");
  assertEquals(patch.webhook_id_sandbox, "wh_9");
  assert("webhook_verificado_sandbox_at" in patch);
  assert(!("webhook_estado_live" in patch));
});
