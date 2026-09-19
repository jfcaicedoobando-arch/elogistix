/**
 * P2-A · FacturAPI 5.0 — Configuración de webhooks SEPARADA por ambiente.
 *
 * Antes existía un único `facturapi_credenciales.webhook_secret` indistinto:
 * si una organización probaba en sandbox y luego pasaba a live, el secret del
 * ambiente viejo seguía firmando eventos del nuevo (o al revés) y los eventos
 * se rechazaban con `invalid_signature` sin diagnóstico.
 *
 * Ahora cada ambiente tiene su propio secret, id de webhook remoto, URL,
 * eventos suscritos y estado de verificación. El campo legado se conserva
 * SÓLO como respaldo de lectura y se reporta como tal (`origen: "legacy"`).
 *
 * Módulo puro: sin red, sin SDK, sin Supabase. Nunca devuelve secretos dentro
 * de los diagnósticos.
 */

export type FacturapiAmbiente = "sandbox" | "live";

export interface CredencialWebhookRow {
  ambiente?: string | null;
  webhook_secret?: string | null;
  webhook_secret_sandbox?: string | null;
  webhook_secret_live?: string | null;
  webhook_id_sandbox?: string | null;
  webhook_id_live?: string | null;
  webhook_url_sandbox?: string | null;
  webhook_url_live?: string | null;
  webhook_eventos_sandbox?: string[] | null;
  webhook_eventos_live?: string[] | null;
}

/** Columnas a leer del registro de credenciales (una sola fuente de verdad). */
export const COLS_WEBHOOK_CRED =
  "ambiente, webhook_secret, webhook_secret_sandbox, webhook_secret_live, " +
  "webhook_id_sandbox, webhook_id_live, webhook_url_sandbox, webhook_url_live, " +
  "webhook_eventos_sandbox, webhook_eventos_live";

export function ambienteDeCredencial(row: CredencialWebhookRow | null): FacturapiAmbiente {
  return row?.ambiente === "live" ? "live" : "sandbox";
}

export interface SecretoWebhook {
  secret: string;
  origen: FacturapiAmbiente | "legacy";
}

/**
 * Secretos candidatos para verificar la firma, en orden de preferencia:
 * 1. el del ambiente activo de la organización;
 * 2. el del ambiente opuesto (una org en transición sandbox → live todavía
 *    recibe eventos del ambiente viejo, y deben validarse con SU secret);
 * 3. el legado indistinto, sólo si ningún secret por ambiente está configurado.
 */
export function resolverSecretosWebhook(
  row: CredencialWebhookRow | null,
  ambiente: FacturapiAmbiente = ambienteDeCredencial(row),
): SecretoWebhook[] {
  if (!row) return [];
  const otro: FacturapiAmbiente = ambiente === "live" ? "sandbox" : "live";
  const por = (amb: FacturapiAmbiente): string | null =>
    (amb === "live" ? row.webhook_secret_live : row.webhook_secret_sandbox) ?? null;

  const lista: SecretoWebhook[] = [];
  const principal = por(ambiente);
  if (principal) lista.push({ secret: principal, origen: ambiente });
  const secundario = por(otro);
  if (secundario) lista.push({ secret: secundario, origen: otro });
  if (lista.length === 0 && row.webhook_secret) {
    lista.push({ secret: row.webhook_secret, origen: "legacy" });
  }
  return lista;
}

/** Eventos que el ERP necesita recibir para mantener el estado fiscal al día. */
export const EVENTOS_REQUERIDOS: readonly string[] = [
  "invoice.status_updated",
  "invoice.cancellation_status_updated",
  "invoice.canceled",
  "invoice.delivered_to_customer",
  "receipt.status_updated",
  "receipt.cancellation_status_updated",
  "receipt.canceled",
];

/** URL que debe quedar registrada en FacturAPI para la organización. */
export function urlWebhookEsperada(baseFunctionsUrl: string, orgId: string): string {
  const base = baseFunctionsUrl.replace(/\/$/, "");
  return `${base}/functions/v1/facturapi-webhook?org=${orgId}`;
}

export type EstadoWebhook =
  | "ok"
  | "no_configurado"
  | "no_encontrado"
  | "url_distinta"
  | "eventos_faltantes"
  | "inactivo";

export interface DiagnosticoWebhook {
  ambiente: FacturapiAmbiente;
  estado: EstadoWebhook;
  /** Español, accionable, sin secretos. */
  mensaje: string;
  urlEsperada: string;
  urlRemota: string | null;
  webhookId: string | null;
  eventosFaltantes: string[];
  eventosRemotos: string[];
  /** `true` cuando la firma se está validando con el secret legado. */
  secretLegado: boolean;
  secretConfigurado: boolean;
}

function mismaUrl(a: string, b: string): boolean {
  const norm = (u: string) => u.trim().replace(/\/$/, "").toLowerCase();
  return norm(a) === norm(b);
}

/** Elige, de los webhooks remotos, el que apunta a esta organización. */
export function elegirWebhookRemoto(
  remotos: readonly { id: string; url?: string }[],
  urlEsperada: string,
  webhookIdGuardado?: string | null,
): { id: string; url?: string } | null {
  const porUrl = remotos.find((w) => typeof w.url === "string" && mismaUrl(w.url, urlEsperada));
  if (porUrl) return porUrl;
  if (webhookIdGuardado) {
    const porId = remotos.find((w) => w.id === webhookIdGuardado);
    if (porId) return porId;
  }
  return null;
}

const MSG: Record<EstadoWebhook, string> = {
  ok: "El webhook del proveedor apunta a esta organización y tiene todos los eventos necesarios.",
  no_configurado: "Esta organización todavía no tiene clave de firma de webhook en este ambiente. " +
    "Guarda la configuración y registra el webhook en el proveedor.",
  no_encontrado: "En este ambiente el proveedor no tiene ningún webhook apuntando a la dirección de esta organización.",
  url_distinta: "El webhook registrado apunta a otra dirección. Actualízalo con la que se muestra aquí.",
  eventos_faltantes: "Al webhook le faltan eventos por suscribir: sin ellos el ERP no se enterará de timbrados o cancelaciones.",
  inactivo: "El webhook existe pero está inactivo en el proveedor: reactívalo.",
};

/**
 * Compara la configuración remota con la esperada. Devuelve sólo datos NO
 * sensibles (URL, id y eventos); jamás el secret.
 */
export function compararConfigRemota(args: {
  ambiente: FacturapiAmbiente;
  urlEsperada: string;
  secretConfigurado: boolean;
  secretLegado: boolean;
  remoto: { id: string; url?: string; events?: string[]; status?: string } | null;
  eventosRequeridos?: readonly string[];
}): DiagnosticoWebhook {
  const requeridos = args.eventosRequeridos ?? EVENTOS_REQUERIDOS;
  const eventosRemotos = args.remoto?.events ?? [];
  const eventosFaltantes = requeridos.filter((e) => !eventosRemotos.includes(e));

  let estado: EstadoWebhook = "ok";
  if (!args.remoto) estado = args.secretConfigurado ? "no_encontrado" : "no_configurado";
  else if (!args.secretConfigurado) estado = "no_configurado";
  else if (typeof args.remoto.url === "string" && !mismaUrl(args.remoto.url, args.urlEsperada)) {
    estado = "url_distinta";
  } else if (args.remoto.status && args.remoto.status !== "active") estado = "inactivo";
  else if (eventosFaltantes.length > 0) estado = "eventos_faltantes";

  return {
    ambiente: args.ambiente,
    estado,
    mensaje: MSG[estado],
    urlEsperada: args.urlEsperada,
    urlRemota: args.remoto?.url ?? null,
    webhookId: args.remoto?.id ?? null,
    eventosFaltantes,
    eventosRemotos,
    secretLegado: args.secretLegado,
    secretConfigurado: args.secretConfigurado,
  };
}

/** Columnas a persistir tras una verificación remota (por ambiente). */
export function patchVerificacion(diag: DiagnosticoWebhook): Record<string, unknown> {
  const suf = diag.ambiente;
  return {
    [`webhook_estado_${suf}`]: diag.estado,
    [`webhook_id_${suf}`]: diag.webhookId,
    [`webhook_url_${suf}`]: diag.urlRemota,
    [`webhook_eventos_${suf}`]: diag.eventosRemotos,
    [`webhook_verificado_${suf}_at`]: new Date().toISOString(),
  };
}
