/**
 * P2-C · FacturAPI 5.0 — Adaptador TIPADO mínimo del SDK.
 *
 * `_shared/facturapiClient.ts` devuelve el cliente como objeto opaco porque el
 * paquete `facturapi` publica sus typings para Node (bundler resolution) y el
 * typecheck de Deno no los resuelve desde `npm:` — el paquete SÍ tiene tipos,
 * simplemente no son visibles aquí. Antes cada edge function hacía su propio
 * cast anónimo (`client as { invoices: { create: ... } }`), duplicando la forma
 * del SDK en una decena de archivos. Este módulo centraliza esos casts en un
 * solo lugar tipado y validado en runtime.
 *
 * Alcance deliberado (YAGNI): sólo las operaciones que el ERP usa hoy.
 *   invoices: create · retrieve · list · cancel · paymentSummary
 *   webhooks: list · retrieve   (verificación remota de configuración)
 */

/** Factura/REP como lo devuelve FacturAPI (campos que el ERP lee). */
export interface FacturapiInvoiceLike {
  id?: string;
  uuid?: string | null;
  status?: string;
  cancellation_status?: string | null;
  total?: number;
  currency?: string;
  folio_number?: number;
  series?: string;
  external_id?: string | null;
  [k: string]: unknown;
}

/**
 * v5.1.0: `SearchResult<T>` trae `page`/`total_pages`/`total_results`
 * OPCIONALES (en v4 eran obligatorios) y `CursorSearchResult<T>` se retiró.
 */
export interface FacturapiSearchResult<T> {
  data: T[];
  page?: number;
  total_pages?: number;
  total_results?: number;
}

/** `GET /invoices/:id/payment-summary` (SDK: `invoices.paymentSummary`). */
export interface FacturapiPaymentSummary {
  uuid?: string;
  folio_number?: number;
  series?: string;
  installment?: number;
  last_balance?: number;
  total?: number;
  currency?: string;
  amount?: number;
  taxes?: Array<{ type?: string; rate?: number; base?: number; amount?: number; withholding?: boolean }>;
}

/** Webhook registrado en FacturAPI (no incluye el secret). */
export interface FacturapiWebhookRemoto {
  id: string;
  url?: string;
  events?: string[];
  status?: string;
  [k: string]: unknown;
}

export interface FacturapiInvoicesApi {
  create: (payload: unknown, opts?: unknown) => Promise<FacturapiInvoiceLike>;
  retrieve: (id: string, opts?: unknown) => Promise<FacturapiInvoiceLike>;
  list: (params?: unknown) => Promise<FacturapiSearchResult<FacturapiInvoiceLike>>;
  cancel: (id: string, params?: unknown) => Promise<FacturapiInvoiceLike>;
  paymentSummary: (id: string, params: { amount: number }) => Promise<FacturapiPaymentSummary>;
}

export interface FacturapiWebhooksApi {
  list: (params?: unknown) => Promise<FacturapiSearchResult<FacturapiWebhookRemoto>>;
  retrieve: (id: string) => Promise<FacturapiWebhookRemoto>;
}

export interface FacturapiApi {
  invoices: Partial<FacturapiInvoicesApi>;
  webhooks?: Partial<FacturapiWebhooksApi>;
}

/** Operaciones que este adaptador sabe exigir. */
export type FacturapiOperacion =
  | `invoices.${keyof FacturapiInvoicesApi}`
  | `webhooks.${keyof FacturapiWebhooksApi}`;

/** El SDK no cumplió el contrato esperado (versión distinta o cliente falso). */
export class FacturapiSdkContratoError extends Error {
  readonly status = 500;
  readonly operacion: string;
  constructor(operacion: string) {
    super(
      `El SDK de FacturAPI no expone \`${operacion}\`. Revisa la versión instalada ` +
        "(`npm:facturapi@5.1.0`) antes de usar esta operación.",
    );
    this.name = "FacturapiSdkContratoError";
    this.operacion = operacion;
  }
}

function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === "object" && valor !== null;
}

/**
 * Convierte el cliente opaco en la superficie tipada. Valida en runtime que el
 * namespace `invoices` exista: cualquier otra forma significa que el SDK cambió.
 */
export function asFacturapiApi(client: unknown): FacturapiApi {
  if (!esObjeto(client) || !esObjeto(client.invoices)) {
    throw new FacturapiSdkContratoError("invoices");
  }
  return client as unknown as FacturapiApi;
}

/**
 * Exige una operación concreta y la devuelve ya ligada (`bind`) al namespace,
 * para que el SDK conserve su `this`.
 */
export function exigirOperacion<T extends (...args: never[]) => unknown>(
  api: FacturapiApi,
  operacion: FacturapiOperacion,
): T {
  const [namespace, metodo] = operacion.split(".") as [keyof FacturapiApi, string];
  const ns = (api as unknown as Record<string, unknown>)[namespace];
  if (!esObjeto(ns)) throw new FacturapiSdkContratoError(namespace);
  const fn = ns[metodo];
  if (typeof fn !== "function") throw new FacturapiSdkContratoError(operacion);
  return (fn as (...args: never[]) => unknown).bind(ns) as T;
}

/** Atajo: `invoices` con las operaciones exigidas presentes. */
export function exigirInvoices(
  client: unknown,
  ...metodos: Array<keyof FacturapiInvoicesApi>
): FacturapiInvoicesApi {
  const api = asFacturapiApi(client);
  for (const m of metodos) exigirOperacion(api, `invoices.${m}`);
  return api.invoices as FacturapiInvoicesApi;
}

/**
 * `webhooks` es opcional en el SDK según la versión/plan: se exige explícito y
 * con error claro, nunca con un cast silencioso.
 */
export function exigirWebhooks(client: unknown): FacturapiWebhooksApi {
  const api = asFacturapiApi(client);
  exigirOperacion(api, "webhooks.list");
  return api.webhooks as FacturapiWebhooksApi;
}

/** ¿El fallo viene del contrato del SDK (no de FacturAPI ni de la red)? */
export function esContratoSdkError(err: unknown): err is FacturapiSdkContratoError {
  return err instanceof FacturapiSdkContratoError;
}

/**
 * Respuesta canónica para un fallo de contrato del SDK: NO se timbró nada, así
 * que el candado (`claim`) se conserva y jamás se reintenta automáticamente
 * (un reintento ciego con otra versión del SDK podría duplicar el CFDI).
 * 503 = condición transitoria del entorno (versión del SDK), diagnosticable
 * con `operacion` y correlacionable con `external_id`.
 */
export function cuerpoContratoSdk(
  err: FacturapiSdkContratoError,
  externalId?: string | null,
): { status: 503; body: Record<string, unknown> } {
  return {
    status: 503,
    body: {
      error: "facturapi_sdk_contrato",
      operacion: err.operacion,
      reintento_automatico: false,
      reintentable: true,
      external_id: externalId ?? null,
      message:
        `${err.message} No se envió nada al PAC y el candado del documento se conserva: ` +
        "avisa a soporte técnico y reintenta manualmente cuando se corrija la versión del SDK.",
    },
  };
}

/**
 * `invoices.cancel` YA está tipada y cubierta por los contract tests de este
 * adaptador, pero el flujo de cancelación (`facturapi-cancelar`,
 * `facturapi-cancelar-rep`, `facturapi-cancelar-nota-credito`) todavía resuelve
 * el SDK con su propio cast: su manejo de timeout persiste
 * `cancellation_status='verifying'` y migrarlo exige rehacer ese contrato de
 * estados. Queda fuera del alcance de este lote (P2-C sólo centraliza
 * `create`, `list` y `paymentSummary`).
 */
