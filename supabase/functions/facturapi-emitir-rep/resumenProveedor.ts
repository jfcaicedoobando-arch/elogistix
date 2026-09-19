/**
 * P1 · FacturAPI 5.0 — `invoices.paymentSummary` como AUTORIDAD previa al
 * timbrado del REP.
 *
 * FacturAPI publica el resumen oficial del pago sobre la factura relacionada:
 * parcialidad, saldo anterior, total, moneda de la FACTURA e impuestos
 * prorrateados al importe pagado (`GET /invoices/:id/payment-summary`,
 * SDK v5.0.0 `invoices.paymentSummary(id, { amount })`).
 *
 * Reglas de este módulo:
 * - `amount` SIEMPRE va en la moneda de la FACTURA (no la del pago si difiere):
 *   `imp_pagado` = `monto_aplicado_factura`, que ya se calcula contra el total
 *   de la factura en su propia moneda.
 * - El cálculo local se conserva como diagnóstico; si el proveedor difiere
 *   fuera de la tolerancia (un centavo, el mismo redondeo del payload) NO se
 *   reclama ni se timbra.
 * - Una divergencia sólo requiere conciliar datos: se registra bitácora y se
 *   responde 422, SIN mutar `estado_rep` a Error.
 * - Si la consulta falla o hace timeout: no se timbra y se responde un error
 *   recuperable (503), también sin mutar estado.
 *
 * Limitación real de la API: el resumen sólo existe para facturas emitidas a
 * través de FacturAPI. Si la factura local no tiene id remoto (legacy o
 * timbrada fuera), no hay nada que cotejar: se deja constancia en bitácora y el
 * flujo continúa con el cálculo local.
 */
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { registrarBitacoraEdge } from "../_shared/bitacora.ts";
import { buildTaxesDr } from "./taxesDr.ts";
import {
  divergenciasResumenPago,
  MSG_REP_PARIDAD_RESUMEN,
  type CalculoRep,
  type ImpuestoRep,
  type ResumenPagoSdk,
} from "./paridadResumen.ts";
import type { PagoContext } from "./helpers.ts";

/** Código estable para Contabilidad y para el frontend. */
export const COD_REP_RESUMEN_DIVERGENTE = "rep_resumen_divergente";
export const COD_REP_RESUMEN_NO_DISPONIBLE = "rep_resumen_no_disponible";

export const MSG_REP_RESUMEN_NO_DISPONIBLE =
  "No pudimos consultar el resumen de pago del proveedor de timbrado, así que no se timbró el " +
  "complemento. No se cambió nada del pago: vuelve a intentarlo en unos minutos.";

/**
 * Timeout local (mismo valor que `FACTURAPI_SDK_TIMEOUT_MS`). No se importa
 * `_shared/facturapiClient.ts` a propósito: ese módulo hace el import estático
 * de `npm:facturapi`, que no resuelve en el runner de pruebas aislado.
 */
export const TIMEOUT_RESUMEN_MS = 30_000;

async function conTimeout<T>(promesa: Promise<T>, ms = TIMEOUT_RESUMEN_MS): Promise<T> {
  let timer = 0;
  try {
    return await Promise.race([
      promesa,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`paymentSummary no respondió en ${ms} ms`)), ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

/** Tolerancia monetaria documentada: un centavo. */
export const TOLERANCIA_RESUMEN = 0.01;

interface ClienteResumen {
  invoices: { paymentSummary: (id: string, params: { amount: number }) => Promise<ResumenRemoto> };
}

export interface ResumenRemoto extends ResumenPagoSdk {
  currency?: string | null;
  total?: number | null;
  uuid?: string | null;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** El `amount` del resumen va en la moneda de la FACTURA (imp_pagado). */
export function montoEnMonedaFactura(ctx: PagoContext): number {
  return round2(Number(ctx.documento_relacionado.imp_pagado ?? 0));
}

/** Cálculo local (diagnóstico) con la misma aritmética del payload del REP. */
export function calculoLocalRep(ctx: PagoContext): CalculoRep {
  const dr = ctx.documento_relacionado;
  const taxes: ImpuestoRep[] = buildTaxesDr(dr).map((t) => ({
    type: t.type as ImpuestoRep["type"],
    rate: Number(t.rate),
    base: round2(Number(t.base)),
    withholding: t.withholding === true,
  }));
  return {
    installment: dr.num_parcialidad,
    last_balance: round2(Number(dr.imp_saldo_ant ?? 0)),
    amount: montoEnMonedaFactura(ctx),
    taxes,
  };
}

/** Divergencias propias de este cotejo (moneda y saldo insoluto derivado). */
export function divergenciasExtra(
  ctx: PagoContext,
  resumen: ResumenRemoto,
  tolerancia = TOLERANCIA_RESUMEN,
): string[] {
  const out: string[] = [];
  const monedaFactura = String(ctx.documento_relacionado.moneda_dr ?? "MXN").toUpperCase();
  const monedaRemota = typeof resumen.currency === "string" ? resumen.currency.toUpperCase() : null;
  if (monedaRemota && monedaRemota !== monedaFactura) {
    out.push(`Moneda del documento: local ${monedaFactura} vs proveedor ${monedaRemota}`);
  }
  if (resumen.last_balance != null && resumen.amount != null) {
    const insolutoRemoto = round2(Number(resumen.last_balance) - Number(resumen.amount));
    const insolutoLocal = round2(Number(ctx.documento_relacionado.imp_saldo_insoluto ?? 0));
    if (Math.abs(insolutoLocal - insolutoRemoto) > tolerancia) {
      out.push(
        `Saldo insoluto: local ${insolutoLocal.toFixed(2)} vs proveedor ${insolutoRemoto.toFixed(2)}`,
      );
    }
  }
  return out;
}

interface ArgsVerificacion {
  facturapi: object;
  facturaFacturapiId: string | null;
  ctx: PagoContext;
  supabase: SupabaseClient;
  pagoId: string;
  organizationId: string;
  usuarioId: string;
  usuarioEmail?: string;
  json: (body: unknown, status?: number) => Response;
}

/**
 * `null` ⇒ paridad (o resumen no verificable): se puede reclamar y timbrar.
 * `Response` ⇒ 422 (conciliar) o 503 (recuperable): NO se timbra.
 */
export async function verificarResumenProveedor(args: ArgsVerificacion): Promise<Response | null> {
  const { ctx, supabase, pagoId, organizationId } = args;
  const monedaFactura = String(ctx.documento_relacionado.moneda_dr ?? "MXN").toUpperCase();
  const bitacora = (accion: string, detalles: Record<string, unknown>) =>
    registrarBitacoraEdge(supabase, {
      organizationId, usuarioId: args.usuarioId, usuarioEmail: args.usuarioEmail,
      modulo: "facturacion", accion, entidadId: pagoId, detalles,
    });

  const idRemoto = args.facturaFacturapiId;
  if (!idRemoto || idRemoto.startsWith("PENDING:")) {
    await bitacora("facturapi_rep_resumen_no_verificable", {
      motivo: "factura_sin_id_remoto", moneda: monedaFactura,
    });
    return null;
  }

  const local = calculoLocalRep(ctx);
  let resumen: ResumenRemoto;
  try {
    // SAFE-CAST: el cliente del SDK se modela como objeto opaco.
    resumen = await conTimeout(
      (args.facturapi as unknown as ClienteResumen).invoices.paymentSummary(idRemoto, {
        amount: local.amount,
      }),
    );
  } catch (err) {
    await bitacora("facturapi_rep_resumen_no_disponible", {
      moneda: monedaFactura, amount: local.amount, error: String((err as Error)?.message ?? err),
    });
    return args.json(
      {
        error: COD_REP_RESUMEN_NO_DISPONIBLE, retryable: true,
        message: MSG_REP_RESUMEN_NO_DISPONIBLE, moneda: monedaFactura,
      },
      503,
    );
  }

  const divergencias = [
    ...divergenciasResumenPago(local, resumen, TOLERANCIA_RESUMEN),
    ...divergenciasExtra(ctx, resumen, TOLERANCIA_RESUMEN),
  ];
  if (divergencias.length === 0) return null;

  await bitacora("facturapi_rep_resumen_divergente", {
    moneda: monedaFactura, divergencias, local, proveedor: resumen,
  });
  return args.json(
    {
      error: COD_REP_RESUMEN_DIVERGENTE,
      message: MSG_REP_PARIDAD_RESUMEN,
      moneda: monedaFactura,
      tolerancia: TOLERANCIA_RESUMEN,
      divergencias,
      local,
      proveedor: {
        installment: resumen.installment ?? null,
        last_balance: resumen.last_balance ?? null,
        amount: resumen.amount ?? null,
        currency: resumen.currency ?? null,
        taxes: resumen.taxes ?? null,
      },
    },
    422,
  );
}
