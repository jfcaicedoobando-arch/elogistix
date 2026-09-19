/**
 * P1 · FacturAPI 5.0 — `invoices.paymentSummary` como autoridad del REP.
 * Sin llamadas reales al PAC: el cliente y Supabase son dobles en memoria.
 */
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  calculoLocalRep,
  COD_REP_RESUMEN_DIVERGENTE,
  COD_REP_RESUMEN_NO_DISPONIBLE,
  montoEnMonedaFactura,
  verificarResumenProveedor,
  type ResumenRemoto,
} from "./resumenProveedor.ts";
import type { PagoContext } from "./helpers.ts";

function ctxBase(over: Partial<PagoContext["documento_relacionado"]> = {}, pago: Partial<PagoContext> = {}): PagoContext {
  return {
    receptor: { legal_name: "ACME", tax_id: "AAA010101AAA", tax_system: "601", address: { zip: "64000" } },
    fecha_pago: "2026-09-18",
    forma_pago: "03",
    moneda: "MXN",
    tipo_cambio: 1,
    monto: 5800,
    documento_relacionado: {
      uuid: "11111111-1111-1111-1111-111111111111",
      moneda_dr: "MXN",
      tipo_cambio_dr: 1,
      num_parcialidad: 1,
      imp_saldo_ant: 11600,
      imp_pagado: 5800,
      imp_saldo_insoluto: 5800,
      metodo_pago: "PPD",
      tasa_iva: 0.16,
      factor_iva: "Tasa",
      grupos_iva: [{ tasa: 0.16, factor: "Tasa", importe: 10000 }],
      subtotal_factura: 10000,
      total_factura: 11600,
      ...over,
    },
    ...pago,
  } as PagoContext;
}

const dbFake = {
  filas: [] as Array<Record<string, unknown>>,
  from() {
    return { insert: (row: Record<string, unknown>) => { dbFake.filas.push(row); return Promise.resolve({ error: null }); } };
  },
};

function clienteConResumen(resumen: ResumenRemoto | Error) {
  return {
    invoices: {
      paymentSummary: (_id: string, params: { amount: number }) => {
        llamadas.push(params.amount);
        return resumen instanceof Error ? Promise.reject(resumen) : Promise.resolve(resumen);
      },
    },
  };
}

let llamadas: number[] = [];

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

async function correr(ctx: PagoContext, resumen: ResumenRemoto | Error, facturaFacturapiId: string | null = "inv_1") {
  llamadas = [];
  dbFake.filas = [];
  const res = await verificarResumenProveedor({
    // SAFE-CAST: dobles de prueba con el subconjunto que el módulo usa.
    facturapi: clienteConResumen(resumen) as unknown as object,
    facturaFacturapiId,
    ctx,
    supabase: dbFake as unknown as Parameters<typeof verificarResumenProveedor>[0]["supabase"],
    pagoId: "pago-1",
    organizationId: "org-1",
    usuarioId: "user-1",
    json,
  });
  return res;
}

Deno.test("MXN en paridad: no bloquea y consulta con el importe de la factura", async () => {
  const res = await correr(ctxBase(), {
    installment: 1, last_balance: 11600, amount: 5800, currency: "MXN",
    taxes: [{ type: "IVA", rate: 0.16, base: 5000, withholding: false }],
  });
  assertEquals(res, null);
  assertEquals(llamadas, [5800]);
});

Deno.test("USD: saldo anterior divergente devuelve 422 con codigo estable", async () => {
  const ctx = ctxBase({ moneda_dr: "USD", imp_saldo_ant: 1160, imp_pagado: 580, imp_saldo_insoluto: 580, grupos_iva: [{ tasa: 0.16, factor: "Tasa", importe: 1000 }], subtotal_factura: 1000, total_factura: 1160 });
  const res = await correr(ctx, { installment: 1, last_balance: 1000, amount: 580, currency: "USD", taxes: [] });
  assertEquals(res?.status, 422);
  const body = await res!.json();
  assertEquals(body.error, COD_REP_RESUMEN_DIVERGENTE);
  assertEquals(body.moneda, "USD");
  assertEquals(body.local.last_balance, 1160);
  assertEquals(body.proveedor.last_balance, 1000);
  assertEquals(body.divergencias.length > 0, true);
});

Deno.test("pago en moneda distinta a la factura: el amount va en moneda de la factura", async () => {
  // Factura en USD, pago en MXN: imp_pagado ya viene convertido a USD.
  const ctx = ctxBase(
    { moneda_dr: "USD", imp_saldo_ant: 1160, imp_pagado: 580, imp_saldo_insoluto: 580, grupos_iva: [{ tasa: 0.16, factor: "Tasa", importe: 1000 }], subtotal_factura: 1000, total_factura: 1160 },
    { moneda: "MXN", tipo_cambio: 18.5, monto: 10730 },
  );
  assertEquals(montoEnMonedaFactura(ctx), 580);
  const res = await correr(ctx, { installment: 1, last_balance: 1160, amount: 580, currency: "USD", taxes: [] });
  assertEquals(res, null);
  assertEquals(llamadas, [580]);
});

Deno.test("moneda distinta en el proveedor se reporta como divergencia", async () => {
  const res = await correr(ctxBase(), { installment: 1, last_balance: 11600, amount: 5800, currency: "USD", taxes: [] });
  assertEquals(res?.status, 422);
  const body = await res!.json();
  assertEquals(body.divergencias.some((d: string) => d.startsWith("Moneda del documento")), true);
});

Deno.test("timeout/fallo del resumen: 503 recuperable sin mutar estado", async () => {
  const res = await correr(ctxBase(), new Error("socket hang up"));
  assertEquals(res?.status, 503);
  const body = await res!.json();
  assertEquals(body.error, COD_REP_RESUMEN_NO_DISPONIBLE);
  assertEquals(body.retryable, true);
  // Sólo bitácora: ninguna escritura toca pagos_factura.
  assertEquals(dbFake.filas.length, 1);
  assertEquals(dbFake.filas[0].accion, "facturapi_rep_resumen_no_disponible");
});

Deno.test("factura sin id remoto: no verificable, continua con calculo local", async () => {
  const res = await correr(ctxBase(), new Error("no debe llamarse"), null);
  assertEquals(res, null);
  assertEquals(llamadas, []);
  assertEquals(dbFake.filas[0].accion, "facturapi_rep_resumen_no_verificable");
});

Deno.test("claim PENDING no se usa como id de factura", async () => {
  const res = await correr(ctxBase(), new Error("no debe llamarse"), "PENDING:abc");
  assertEquals(res, null);
  assertEquals(llamadas, []);
});

Deno.test("calculo local usa la misma aritmetica del payload (mezcla 16% + no objeto)", () => {
  const ctx = ctxBase({
    grupos_iva: [{ tasa: 0.16, factor: "Tasa", importe: 6000 }],
    hay_no_objeto: true, objeto_imp_dr: "02", importe_no_objeto: 4000,
    subtotal_factura: 10000, total_factura: 10960, imp_saldo_ant: 10960, imp_pagado: 5480, imp_saldo_insoluto: 5480,
  });
  const local = calculoLocalRep(ctx);
  assertEquals(local.installment, 1);
  assertEquals(local.amount, 5480);
  assertEquals(local.taxes.length, 1);
  assertEquals(local.taxes[0].rate, 0.16);
});
