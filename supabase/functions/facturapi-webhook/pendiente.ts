/**
 * P0-A.4 — Resolución de filas con TIMBRADO PENDIENTE desde el webhook.
 *
 * Cuando `invoices.create` responde `status: "pending"`, la fila local conserva
 * su claim (`PENDING:<uuid>`) y guarda el id remoto del intento. El evento
 * `valid` posterior llega con ese mismo id, así que buscar sólo por
 * `facturapi_id` perdía el evento para siempre. Aquí se agrega el respaldo:
 * por id remoto pendiente y por el `external_id` del evento (= claimTag).
 *
 * P0 correctivo — un `*_pendiente_id` RESIDUAL (de un intento ya liberado) no
 * autoriza a promover nada: la vía "pendiente" exige que la fila siga poseyendo
 * un claim `PENDING:%`, y la escritura usa CAS sobre ese claim para no pisar
 * una recaptura concurrente.
 */
import { uuidFiscalValido } from "../_shared/timbradoPendiente.ts";
import type { FacturapiWebhookEvent } from "./helpers.ts";

export interface ColsPendiente {
  /** Columna con el id de FacturAPI / claim. */
  claim: string;
  claimAt: string;
  pendienteId: string;
  pendienteAt: string;
  /** Columna del UUID fiscal en el patch. */
  uuid: string;
}

export const COLS_FACTURA: ColsPendiente = {
  claim: "facturapi_id",
  claimAt: "facturapi_claim_at",
  pendienteId: "facturapi_pendiente_id",
  pendienteAt: "facturapi_pendiente_at",
  uuid: "uuid_fiscal",
};

export const COLS_REP: ColsPendiente = {
  claim: "facturapi_rep_id",
  claimAt: "facturapi_rep_claim_at",
  pendienteId: "facturapi_rep_pendiente_id",
  pendienteAt: "facturapi_rep_pendiente_at",
  uuid: "uuid_rep",
};

/** `external_id` del objeto del evento (el claimTag `PENDING:<uuid>`). */
export function externalIdDeEvento(ev: FacturapiWebhookEvent): string | null {
  const ext = ev.data?.object?.external_id;
  return typeof ext === "string" && ext.length > 0 ? ext : null;
}

/** Un claim vivo de intento pendiente siempre es `PENDING:<uuid>`. */
export function claimEsPendiente(valor: unknown): boolean {
  return typeof valor === "string" && valor.startsWith("PENDING:");
}

interface DbBusqueda {
  from: (t: string) => {
    select: (c: string) => {
      eq: (c: string, v: string) => {
        eq: (c: string, v: string) => PromiseLike<{ data: unknown }> & {
          maybeSingle: () => PromiseLike<{ data: unknown }>;
        };
      };
    };
  };
}

export interface FilaLocalizada<T> {
  fila: T;
  /** "claim" = match directo por id; "pendiente" = intento pendiente. */
  via: "claim" | "pendiente";
  /**
   * Valor actual de la columna de claim. La escritura lo usa como CAS
   * (`.eq(cols.claim, claimActual)`) para no pisar una recaptura concurrente.
   */
  claimActual: string | null;
}

/**
 * Busca la fila del evento: primero por el id remoto, luego por el id del
 * intento pendiente y por último por el claim (`external_id` del evento).
 */
export async function localizarFila<T>(args: {
  supabase: DbBusqueda;
  tabla: string;
  select: string;
  orgId: string;
  cols: ColsPendiente;
  remoteId: string;
  externalId: string | null;
}): Promise<FilaLocalizada<T> | null> {
  const buscar = async (col: string, valor: string): Promise<T | null> => {
    const { data } = await args.supabase
      .from(args.tabla)
      .select(args.select)
      .eq(col, valor)
      .eq("organization_id", args.orgId)
      .maybeSingle();
    return (data as T | null) ?? null;
  };
  const claimDe = (fila: T): string | null => {
    const v = (fila as Record<string, unknown>)[args.cols.claim];
    return typeof v === "string" ? v : null;
  };

  const porClaim = await buscar(args.cols.claim, args.remoteId);
  if (porClaim) return { fila: porClaim, via: "claim", claimActual: claimDe(porClaim) };

  // Vía pendiente: sólo si la fila sigue poseyendo el claim del intento. Un
  // `*_pendiente_id` residual tras liberar/recapturar NO debe promover nada.
  const porPendiente = await buscar(args.cols.pendienteId, args.remoteId);
  if (porPendiente && claimEsPendiente(claimDe(porPendiente))) {
    return { fila: porPendiente, via: "pendiente", claimActual: claimDe(porPendiente) };
  }

  if (args.externalId) {
    const porExternal = await buscar(args.cols.claim, args.externalId);
    if (porExternal && claimEsPendiente(claimDe(porExternal))) {
      return { fila: porExternal, via: "pendiente", claimActual: claimDe(porExternal) };
    }
  }
  return null;
}

/**
 * Patch extra para adoptar el id definitivo de un intento pendiente.
 * `null` ⇒ el evento NO promueve (sigue sin timbre): no se toca la fila.
 */
export function patchAdopcionPendiente(
  cols: ColsPendiente,
  remoteId: string,
  patch: Record<string, unknown>,
): Record<string, unknown> | null {
  if (!uuidFiscalValido(patch[cols.uuid])) return null;
  return {
    [cols.claim]: remoteId,
    [cols.claimAt]: null,
    [cols.pendienteId]: null,
    [cols.pendienteAt]: null,
  };
}
