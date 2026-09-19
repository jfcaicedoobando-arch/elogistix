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
  urlWebhookEsperada,
} from "./facturapiWebhookConfig.ts";

const URL_ESPERADA = urlWebhookEsperada("https://proj.supabase.co", "org-1");

Deno.test("la URL esperada incluye ?org y no duplica slashes", () => {
  assertEquals(URL_ESPERADA, "https://proj.supabase.co/functions/v1/facturapi-webhook?org=org-1");
  assertEquals(urlWebhookEsperada("https://proj.supabase.co/", "org-1"), URL_ESPERADA);
});

Deno.test("secretos: el del ambiente activo va primero y el opuesto queda como respaldo", () => {
  const row = {
    ambiente: "live",
    webhook_secret_sandbox: "s-sbx",
    webhook_secret_live: "s-live",
    webhook_secret: "s-legacy",
  };
  assertEquals(ambienteDeCredencial(row), "live");
  assertEquals(resolverSecretosWebhook(row), [
    { secret: "s-live", origen: "live" },
    { secret: "s-sbx", origen: "sandbox" },
  ]);
  assertEquals(resolverSecretosWebhook(row, "sandbox")[0], { secret: "s-sbx", origen: "sandbox" });
});

Deno.test("el secret legado sólo se usa si no hay ninguno por ambiente", () => {
  assertEquals(resolverSecretosWebhook({ ambiente: "sandbox", webhook_secret: "viejo" }), [
    { secret: "viejo", origen: "legacy" },
  ]);
  const conAmbiente = resolverSecretosWebhook({
    ambiente: "sandbox", webhook_secret: "viejo", webhook_secret_sandbox: "nuevo",
  });
  assertEquals(conAmbiente, [{ secret: "nuevo", origen: "sandbox" }]);
  assertEquals(resolverSecretosWebhook(null), []);
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
