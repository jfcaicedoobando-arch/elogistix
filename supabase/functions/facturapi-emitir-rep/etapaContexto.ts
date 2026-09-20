/**
 * Etapa 3 — Construcción y validación del `PagoContext` del REP.
 *
 * `construirPagoContext` es pura (mismos campos y coerciones que antes vivían
 * en `index.ts`). `validarPagoContext` aplica `validateRepContext` y, ante
 * inconsistencias, marca `estado_rep = "Error"` y responde 422 con los issues,
 * exactamente como antes.
 */
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { validateRepContext, type PagoContext } from "./helpers.ts";
import type { DatosPagoRep, FacturaRep, PagoRep } from "./etapaDatos.ts";
import type { FiscalDr } from "./etapaFiscal.ts";
import { etapaCorte, etapaOk, type Etapa, type JsonFn } from "./etapaResultado.ts";

function receptorDe(factura: FacturaRep, datos: DatosPagoRep): PagoContext["receptor"] {
  const { cliente } = datos;
  return {
    legal_name: cliente.nombre,
    tax_id: factura.rfc_cliente ?? cliente.rfc ?? "",
    tax_system: cliente.regimen_fiscal ?? "",
    address: { zip: cliente.codigo_postal ?? "" },
    email: datos.emailContacto,
  };
}

function documentoRelacionadoDe(
  factura: FacturaRep,
  fiscal: FiscalDr,
  parcialidad: DatosPagoRep["parcialidad"],
): PagoContext["documento_relacionado"] {
  return {
    uuid: factura.uuid_fiscal,
    folio: factura.folio_fiscal != null ? String(factura.folio_fiscal) : null,
    serie: factura.serie ?? null,
    moneda_dr: factura.moneda ?? "MXN",
    tipo_cambio_dr: Number(factura.tipo_cambio ?? 1),
    num_parcialidad: parcialidad.numParcialidad,
    imp_saldo_ant: parcialidad.saldoAnt,
    imp_pagado: parcialidad.impPagado,
    imp_saldo_insoluto: parcialidad.saldoInsoluto,
    metodo_pago: "PPD",
    tasa_iva: fiscal.tasaIvaDr,
    factor_iva: fiscal.factorIvaFactura,
    grupos_iva: fiscal.gruposIva,
    retenciones: fiscal.retenciones,
    subtotal_factura: Number(factura.subtotal ?? 0),
    total_factura: Number(factura.total ?? 0),
    hay_no_objeto: fiscal.hayNoObjeto,
    objeto_imp_dr: fiscal.objetoImpDr,
    importe_no_objeto: fiscal.importeNoObjeto,
  };
}

export function construirPagoContext(args: {
  factura: FacturaRep;
  pago: PagoRep;
  fiscal: FiscalDr;
  datos: DatosPagoRep;
}): PagoContext {
  const { factura, pago, fiscal, datos } = args;
  return {
    receptor: receptorDe(factura, datos),
    fecha_pago: typeof pago.fecha_pago === "string"
      ? pago.fecha_pago
      : new Date(pago.fecha_pago as unknown as string).toISOString(),
    forma_pago: pago.forma_pago ?? "",
    moneda: pago.moneda ?? "MXN",
    tipo_cambio: Number(pago.tipo_cambio ?? 1),
    monto: Number(pago.monto ?? 0),
    numero_operacion: pago.referencia ?? null,
    documento_relacionado: documentoRelacionadoDe(factura, fiscal, datos.parcialidad),
    referencias: datos.refs,
  };
}

/** 422 `validation_failed` (marcando `estado_rep = "Error"`) o el contexto listo. */
export async function validarPagoContext(
  supabase: SupabaseClient,
  ctx: PagoContext,
  pagoId: string,
  json: JsonFn,
): Promise<Etapa<PagoContext>> {
  const issues = validateRepContext(ctx);
  if (issues.length === 0) return etapaOk(ctx);
  await supabase.from("pagos_factura")
    .update({ estado_rep: "Error", rep_error: issues.map((i) => i.message).join("; ") })
    .eq("id", pagoId);
  return etapaCorte(json({ error: "validation_failed", issues }, 422));
}
