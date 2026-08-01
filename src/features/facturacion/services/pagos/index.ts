import { supabase } from "@/integrations/supabase/client";
import { unwrap, unwrapOr, run } from "@/lib/supabase/response";
import type { Tables } from "@/integrations/supabase/types";
import { registrarActividad } from "@/services/bitacora/registrar";


export type PagoFactura = Tables<"pagos_factura">;

export interface RegistrarPagoInput {
  factura_id: string;
  fecha_pago: string;
  monto: number;
  moneda: PagoFactura["moneda"];
  tipo_cambio: number;
  monto_aplicado_factura: number;
  forma_pago: string;
  referencia?: string;
  notas?: string;
  /**
   * Diferencia cambiaria en MXN. Aplica cuando la factura es USD/EUR y el
   * pago se recibe en MXN: monto MXN recibido − (monto_aplicado_factura × TC
   * de emisión). El UI calcula y manda el valor; default 0.
   */
  diferencia_cambiaria_mxn?: number;
}

export async function listarPagosFactura(facturaId: string): Promise<PagoFactura[]> {
  return unwrapOr(
    supabase
      .from("pagos_factura")
      .select("*")
      .eq("factura_id", facturaId)
      .order("fecha_pago", { ascending: false })
      .limit(500),
    [],
  );
}

/**
 * Inserta un pago y devuelve el `id` recién creado (útil para encadenar el
 * timbrado del REP en facturas PPD). Devuelve `null` si Supabase no regresa
 * la fila (no debería suceder en producción, pero los tests con mocks viejos
 * pueden devolver `data: null`).
 */
export async function registrarPagoFactura(
  input: RegistrarPagoInput,
): Promise<string | null> {
  const { data: userData } = await supabase.auth.getUser();
  const created_by = userData.user?.id ?? null;
  const data = await unwrap(
    supabase
      .from("pagos_factura")
      .insert({
        factura_id: input.factura_id,
        fecha_pago: input.fecha_pago,
        monto: input.monto,
        moneda: input.moneda,
        tipo_cambio: input.tipo_cambio,
        monto_aplicado_factura: input.monto_aplicado_factura,
        forma_pago: input.forma_pago,
        referencia: input.referencia ?? "",
        notas: input.notas ?? "",
        diferencia_cambiaria_mxn: input.diferencia_cambiaria_mxn ?? 0,
        created_by,
      })
      .select("id")
      .single(),
  );
  const pagoId = (data as { id?: string } | null)?.id ?? null;
  // P2-6 (R5): los pagos de cliente no aparecían en la bitácora/actividad
  // (sólo los de proveedor), así que la línea de tiempo quedaba incompleta.
  await registrarActividad({
    modulo: "facturacion",
    accion: "registrar_pago",
    entidadId: input.factura_id,
    detalles: {
      pago_id: pagoId,
      monto: input.monto,
      moneda: input.moneda,
      monto_aplicado_factura: input.monto_aplicado_factura,
      forma_pago: input.forma_pago,
      referencia: input.referencia ?? null,
    },
  });
  return pagoId;
}

/**
 * Error tipado (Fase R.5 · Bug 8): se intentó eliminar un pago cuyo REP
 * (complemento de pago) aún está vigente (`uuid_rep IS NOT NULL AND
 * rep_cancelado_en IS NULL`). El usuario debe cancelar el REP primero.
 */
export class PagoConRepVivoError extends Error {
  readonly code = "LC_PAGO_CON_REP_VIVO" as const;
  readonly uuidRep: string | null;
  constructor(uuidRep: string | null) {
    super(
      "No se puede eliminar el pago porque tiene un complemento de pago (REP) vigente. Cancela el REP antes de eliminar el pago.",
    );
    this.name = "PagoConRepVivoError";
    this.uuidRep = uuidRep;
  }
}

function esErrorPagoConRepVivo(err: unknown): boolean {
  if (err instanceof Error) return /LC_PAGO_CON_REP_VIVO/.test(err.message);
  if (err && typeof err === "object" && "message" in err) {
    const m = (err as { message?: unknown }).message;
    if (typeof m === "string") return /LC_PAGO_CON_REP_VIVO/.test(m);
  }
  return /LC_PAGO_CON_REP_VIVO/.test(String(err ?? ""));
}

export async function eliminarPagoFactura(id: string): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();

  // Defensa temprana: leemos uuid_rep + rep_cancelado_en para dar mensaje en
  // español sin esperar el error del trigger (ahorra roundtrip y evita ruido
  // en Sentry). El trigger BD `trg_pago_sin_rep_vivo` sigue siendo la fuente
  // de verdad ante race conditions.
  const { data: pago } = await supabase
    .from("pagos_factura")
    .select("id, uuid_rep, rep_cancelado_en")
    .eq("id", id)
    .maybeSingle();
  if (pago?.uuid_rep && !pago.rep_cancelado_en) {
    throw new PagoConRepVivoError(pago.uuid_rep);
  }

  try {
    await run(
      supabase
        .from("pagos_factura")
        .update({ deleted_at: new Date().toISOString(), deleted_by: userData.user?.id ?? null })
        .eq("id", id),
    );
  } catch (err) {
    if (esErrorPagoConRepVivo(err)) {
      throw new PagoConRepVivoError(pago?.uuid_rep ?? null);
    }
    throw err;
  }
  await registrarActividad({
    modulo: "facturacion",
    accion: "eliminar_pago",
    entidadId: pago?.id ?? id,
    detalles: { pago_id: id },
  });
}

