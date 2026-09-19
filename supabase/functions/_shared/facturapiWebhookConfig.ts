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

/** Secret registrado para UN ambiente concreto (sin fallbacks). */
export function secretPorAmbiente(
  row: CredencialWebhookRow | null,
  ambiente: FacturapiAmbiente,
): string | null {
  if (!row) return null;
  return (ambiente === "live" ? row.webhook_secret_live : row.webhook_secret_sandbox) ?? null;
}

/** `true` si la organización ya tiene al menos un secret POR AMBIENTE. */
export function tieneSecretPorAmbiente(row: CredencialWebhookRow | null): boolean {
  return Boolean(secretPorAmbiente(row, "sandbox") || secretPorAmbiente(row, "live"));
}

export interface OpcionesSecretosWebhook {
  /**
   * Ambiente aislado declarado en la propia URL del webhook (`&amb=sandbox|live`).
   * Es el ÚNICO mecanismo de transición: cada ambiente usa su propia URL y su
   * propio secret, sin mezclarse. Si no viene, manda el ambiente activo.
   */
  ambienteSolicitado?: FacturapiAmbiente | null;
  /**
   * Fin (ISO) de la ventana de compatibilidad del secret legado indistinto.
   * Sin fecha vigente, el legado NO se acepta.
   */
  legacyHasta?: string | null;
  ahora?: Date;
}

function legacyVigente(hasta: string | null | undefined, ahora: Date): boolean {
  if (!hasta) return false;
  const ts = Date.parse(hasta);
  return Number.isFinite(ts) && ts > ahora.getTime();
}

/**
 * P2 (corrección de aislamiento) · Secreto ÚNICO aceptado para verificar la
 * firma del webhook. El endpoint sólo recibe `?org=`, así que no puede saber en
 * qué ambiente se originó el evento: aceptar además el secret del ambiente
 * opuesto permitiría que un evento de Sandbox mutara la base de una
 * organización en Live. Por eso:
 *
 *  1. se acepta EXCLUSIVAMENTE el secret del ambiente pedido (el activo, o el
 *     declarado en la URL aislada `&amb=`);
 *  2. jamás se prueba el ambiente opuesto;
 *  3. el secret legado indistinto sólo se acepta si NO hay ningún secret por
 *     ambiente y además hay ventana de compatibilidad vigente y auditable.
 */
export function resolverSecretosWebhook(
  row: CredencialWebhookRow | null,
  opciones: OpcionesSecretosWebhook = {},
): SecretoWebhook[] {
  if (!row) return [];
  const ambiente = opciones.ambienteSolicitado ?? ambienteDeCredencial(row);
  const propio = secretPorAmbiente(row, ambiente);
  if (propio) return [{ secret: propio, origen: ambiente }];
  // Hay secret del otro ambiente pero no del pedido: fail-closed (sin mezcla).
  if (tieneSecretPorAmbiente(row)) return [];
  if (row.webhook_secret && legacyVigente(opciones.legacyHasta, opciones.ahora ?? new Date())) {
    return [{ secret: row.webhook_secret, origen: "legacy" }];
  }
  return [];
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

/**
 * URL que debe quedar registrada en FacturAPI para la organización.
 *
 * Con `ambienteAislado` devuelve la variante con `&amb=` — la que se registra
 * cuando la organización necesita recibir Sandbox y Live en paralelo: cada
 * ambiente tiene su propia URL y sólo su propio secret la valida.
 */
export function urlWebhookEsperada(
  baseFunctionsUrl: string,
  orgId: string,
  ambienteAislado?: FacturapiAmbiente | null,
): string {
  const base = baseFunctionsUrl.replace(/\/$/, "");
  const sufijo = ambienteAislado ? `&amb=${ambienteAislado}` : "";
  return `${base}/functions/v1/facturapi-webhook?org=${orgId}${sufijo}`;
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

/**
 * Elige, de los webhooks remotos, el que apunta a esta organización. Acepta
 * varias URLs válidas (la simple y la aislada por ambiente).
 */
export function elegirWebhookRemoto(
  remotos: readonly { id: string; url?: string }[],
  urlEsperada: string | readonly string[],
  webhookIdGuardado?: string | null,
): { id: string; url?: string } | null {
  const aceptadas = Array.isArray(urlEsperada) ? urlEsperada : [urlEsperada as string];
  const porUrl = remotos.find(
    (w) => typeof w.url === "string" && aceptadas.some((u) => mismaUrl(w.url as string, u)),
  );
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
