/**
 * Caracterización de las etapas extraídas de `index.ts` (emitir REP).
 * Cubre: contexto válido con la mezcla 16% + "No objeto", divergencia y falla
 * de `paymentSummary` ANTES del claim, claim ya tomado (409), timbrado
 * pendiente (202 sin marcar Timbrado) y éxito con persistencia.
 *
 * Límite conocido del runner: no se importa `casoUso.ts` porque arrastra
 * `timbrar.ts → _shared/facturapiClient.ts`, que hace el import estático de
 * `npm:facturapi` (no resuelve fuera de Supabase). Se prueban las mismas etapas
 * que el caso de uso encadena, en el mismo orden.
 */
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { construirPagoContext, validarPagoContext } from "./etapaContexto.ts";
import { resolverFiscalDr } from "./etapaFiscal.ts";
import {
  COD_REP_RESUMEN_DIVERGENTE,
  COD_REP_RESUMEN_NO_DISPONIBLE,
  verificarResumenProveedor,
} from "./resumenProveedor.ts";
import { reservarRep } from "./claimRep.ts";
import { respuestaSiRepPendiente } from "./pendiente.ts";
import { persistirRepTimbrado } from "./persistir.ts";
import type { FacturaRep, PagoRep } from "./etapaDatos.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const PAGO: PagoRep = {
  id: "pago-1", factura_id: "f1", organization_id: "org-1", fecha_pago: "2026-01-15",
  monto: 1160, moneda: "MXN", tipo_cambio: 1, forma_pago: "03", referencia: "REF-9",
  monto_aplicado_factura: 1160, estado_rep: null, facturapi_rep_id: null, uuid_rep: null,
};
const FACTURA: FacturaRep = {
  id: "f1", numero: "A-1", serie: "A", total: 1392, subtotal: 1200, iva: 160, moneda: "MXN",
  tipo_cambio: 1, metodo_pago: "PPD", uuid_fiscal: "UUID-FACTURA", folio_fiscal: 7,
  cliente_id: "c1", rfc_cliente: "XAXX010101000", expediente: "EXP-1", referencia_bl: "BL-1",
};
const DATOS = {
  cliente: { id: "c1", nombre: "Cliente Demo", rfc: "XAXX010101000", codigo_postal: "64000", regimen_fiscal: "601" },
  emailContacto: "cliente@demo.mx",
  parcialidad: { numParcialidad: 1, saldoAnt: 1392, impPagado: 1160, saldoInsoluto: 232 },
  refs: { expediente: "EXP-1", bl_master: null, bl_house: "BL-1" },
};

function contexto() {
  const fiscal = resolverFiscalDr(
    [
      { tipo_iva: "gravado_16", tasa_iva_aplicada: 0.16, total: 1000 },
      { tipo_iva: "no_objeto", tasa_iva_aplicada: null, total: 200 },
    ],
    { subtotal: 1200, iva: 160 },
  );
  assert(fiscal.ok);
  return construirPagoContext({ factura: FACTURA, pago: PAGO, fiscal: fiscal.fiscal, datos: DATOS });
}

interface Registro { tabla: string; patch: Record<string, unknown> }

/** Cliente de Supabase que esperan las etapas (sólo se usa el subconjunto). */
type Db = Parameters<typeof validarPagoContext>[0];

/** Doble mínimo del cliente: registra updates/inserts y permite fijar el claim. */
function fakeDb(updateResultados: Array<Record<string, unknown> | null> = []) {
  const updates: Registro[] = [];
  const cola = [...updateResultados];
  const query = () => {
    const resolver = () =>
      Promise.resolve({ data: cola.length > 0 ? cola.shift()! : { id: "pago-1" }, error: null });
    const q: Record<string, unknown> = {};
    for (const m of ["select", "eq", "is", "in", "not", "order", "limit"]) q[m] = () => q;
    q.maybeSingle = resolver;
    q.then = (ok: (v: unknown) => unknown, err: (e: unknown) => unknown) => resolver().then(ok, err);
    return q;
  };
  const supabase = {
    from: (tabla: string) => ({
      select: () => query(),
      update: (patch: Record<string, unknown>) => {
        updates.push({ tabla, patch });
        return query();
      },
      insert: () => Promise.resolve({ data: null, error: null }),
    }),
    storage: { from: () => ({ upload: () => Promise.resolve({ error: { message: "sin storage" } }) }) },
  };
  return { supabase: supabase as unknown as Db, updates };
}

Deno.test("contexto: mezcla 16% + No objeto queda válido con ObjetoImpDR 02", async () => {
  const db = fakeDb();
  const etapa = await validarPagoContext(db.supabase, contexto(), PAGO.id, json);
  assert(etapa.ok);
  assertEquals(etapa.valor.documento_relacionado.objeto_imp_dr, "02");
  assertEquals(etapa.valor.documento_relacionado.hay_no_objeto, true);
  assertEquals(etapa.valor.documento_relacionado.importe_no_objeto, 200);
  assertEquals(db.updates.length, 0);
});

Deno.test("paymentSummary divergente: 422 estable, sin claim y sin estado_rep Error", async () => {
  const db = fakeDb();
  const res = await verificarResumenProveedor({
    facturapi: { invoices: { paymentSummary: () => Promise.resolve({ installment: 9, last_balance: 0, amount: 0, currency: "USD", taxes: [] }) } },
    facturaFacturapiId: "fapi-factura-1", ctx: contexto(), supabase: db.supabase,
    pagoId: PAGO.id, organizationId: "org-1", usuarioId: "u1", usuarioEmail: "u1@demo.mx", json,
  });
  assert(res);
  assertEquals(res.status, 422);
  const body = await res.json();
  assertEquals(body.error, COD_REP_RESUMEN_DIVERGENTE);
  assert(body.divergencias.length > 0);
  assertEquals(db.updates.length, 0);
});

Deno.test("paymentSummary no disponible: 503 recuperable sin mutar estado", async () => {
  const db = fakeDb();
  const res = await verificarResumenProveedor({
    facturapi: { invoices: { paymentSummary: () => Promise.reject(new Error("502 bad gateway")) } },
    facturaFacturapiId: "fapi-factura-1", ctx: contexto(), supabase: db.supabase,
    pagoId: PAGO.id, organizationId: "org-1", usuarioId: "u1", json,
  });
  assert(res);
  assertEquals(res.status, 503);
  const body = await res.json();
  assertEquals(body.error, COD_REP_RESUMEN_NO_DISPONIBLE);
  assertEquals(body.retryable, true);
  assertEquals(db.updates.length, 0);
});

Deno.test("claim ya tomado por otro proceso: 409 antes de llamar al proveedor", async () => {
  const db = fakeDb([null]);
  const reserva = await reservarRep(db.supabase, PAGO, json);
  assert("response" in reserva);
  assertEquals(reserva.response.status, 409);
  assertEquals((await reserva.response.json()).error, "ya_timbrado_rep");
});

Deno.test("timbrado pendiente: 202 sin marcar Timbrado ni guardar UUID", async () => {
  const db = fakeDb();
  const res = await respuestaSiRepPendiente(
    { id: "fapi-rep-1", uuid: null, status: "pending" },
    {
      supabase: db.supabase, pagoId: PAGO.id, organizationId: "org-1",
      claimTag: "PENDING:abc", usuarioId: "u1", json,
    },
  );
  assert(res);
  assertEquals(res.status, 202);
  const patches = db.updates.map((u) => u.patch);
  assertEquals(patches.some((p) => p.estado_rep === "Timbrado"), false);
  assertEquals(patches.some((p) => p.uuid_rep != null), false);
  assert(patches.some((p) => p.facturapi_rep_pendiente_id === "fapi-rep-1"));
});

Deno.test("éxito: persiste Timbrado con uuid, folio y serie y limpia el pendiente", async () => {
  const fetchOriginal = globalThis.fetch;
  globalThis.fetch = () => Promise.resolve(new Response("<xml/>", { status: 200 }));
  try {
    const db = fakeDb();
    const res = await persistirRepTimbrado({
      supabase: db.supabase,
      invoice: { id: "fapi-rep-1", uuid: "UUID-REP", folio_number: 12, series: "P" },
      apiKey: "sk_test_x", ambiente: "sandbox", claimTag: "PENDING:abc",
      pagoId: PAGO.id, facturaId: FACTURA.id, organizationId: "org-1",
      usuarioId: "u1", usuarioEmail: "u1@demo.mx", json,
    });
    assertEquals(res.status, 200);
    const body = await res.json();
    assertEquals(body.uuid, "UUID-REP");
    assertEquals(body.folio, 12);
    assertEquals(body.serie, "P");
    const final = db.updates.at(-1)!.patch;
    assertEquals(final.estado_rep, "Timbrado");
    assertEquals(final.uuid_rep, "UUID-REP");
    assertEquals(final.facturapi_rep_id, "fapi-rep-1");
    assertEquals(final.facturapi_rep_pendiente_id, null);
  } finally {
    globalThis.fetch = fetchOriginal;
  }
});
