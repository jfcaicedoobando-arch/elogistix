/**
 * Caracterización del caso de uso "emitir REP" tras extraer las etapas.
 * Cubre: divergencia y falla de `paymentSummary` ANTES del claim, claim ya
 * tomado (409), timbrado pendiente (202 sin marcar Timbrado) y éxito con
 * persistencia.
 */
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { emitirRepCasoUso } from "./casoUso.ts";
import { COD_REP_RESUMEN_DIVERGENTE, COD_REP_RESUMEN_NO_DISPONIBLE } from "./resumenProveedor.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const PAGO = {
  id: "pago-1", factura_id: "f1", organization_id: "org-1", fecha_pago: "2026-01-15",
  monto: 1160, moneda: "MXN", tipo_cambio: 1, forma_pago: "03", referencia: "REF-9",
  monto_aplicado_factura: 1160, estado_rep: null, facturapi_rep_id: null, uuid_rep: null,
};
const FACTURA = {
  id: "f1", numero: "A-1", serie: "A", total: 1160, subtotal: 1000, iva: 160, moneda: "MXN",
  tipo_cambio: 1, metodo_pago: "PPD", uuid_fiscal: "UUID-FACTURA", folio_fiscal: 7,
  cliente_id: "c1", rfc_cliente: "XAXX010101000", embarque_id: null, expediente: "EXP-1",
  referencia_bl: "BL-1", facturapi_id: null as string | null,
};
const CLIENTE = {
  id: "c1", nombre: "Cliente Demo", rfc: "XAXX010101000", codigo_postal: "64000", regimen_fiscal: "601",
};
const CONCEPTOS = [{ tipo_iva: "gravado_16", tasa_iva_aplicada: 0.16, total: 1000 }];

interface OpcionesDb {
  facturapiId?: string | null;
  /** Resultados en orden de los `update(...).select().maybeSingle()`. */
  updateResultados?: Array<Record<string, unknown> | null>;
}

interface Registro { tabla: string; patch: Record<string, unknown> }

function fakeDb(opts: OpcionesDb = {}) {
  const updates: Registro[] = [];
  const inserts: Registro[] = [];
  const cola = [...(opts.updateResultados ?? [])];
  const datos: Record<string, unknown> = {
    pagos_factura: { ...PAGO },
    facturas: { ...FACTURA, facturapi_id: opts.facturapiId ?? null },
    clientes: { ...CLIENTE },
    contactos_cliente: { email: "cliente@demo.mx" },
    conceptos_factura: CONCEPTOS,
    factura_notas_credito: [],
    organization_members: { role: "contador" },
    user_roles: null,
    embarques: null,
  };

  const query = (tabla: string, modo: "select" | "update") => {
    const resolver = () => {
      if (modo === "update") {
        const siguiente = cola.length > 0 ? cola.shift()! : { id: "pago-1" };
        return Promise.resolve({ data: siguiente, error: null });
      }
      // La lista de pagos previos es la única lectura que espera un arreglo.
      const d = tabla === "pagos_factura" ? [{ ...PAGO }] : datos[tabla] ?? null;
      return Promise.resolve({ data: d, error: null });
    };
    const q: Record<string, unknown> = {};
    for (const m of ["select", "eq", "is", "in", "not", "order", "limit"]) {
      q[m] = () => q;
    }
    q.maybeSingle = async () => {
      const { data, error } = modo === "update" ? await resolver() : { data: datos[tabla] ?? null, error: null };
      return { data: Array.isArray(data) ? data[0] ?? null : data, error };
    };
    // deno-lint-ignore no-explicit-any
    q.then = (ok: any, err: any) => resolver().then(ok, err);
    return q;
  };

  const supabase = {
    from: (tabla: string) => ({
      select: () => query(tabla, "select"),
      update: (patch: Record<string, unknown>) => {
        updates.push({ tabla, patch });
        return query(tabla, "update");
      },
      insert: (patch: Record<string, unknown>) => {
        inserts.push({ tabla, patch });
        return Promise.resolve({ data: null, error: null });
      },
    }),
    storage: { from: () => ({ upload: () => Promise.resolve({ error: { message: "sin storage" } }) }) },
  };
  // deno-lint-ignore no-explicit-any
  return { supabase: supabase as any, updates, inserts };
}

function correr(
  db: ReturnType<typeof fakeDb>,
  invoices: Record<string, unknown>,
): Promise<Response> {
  return emitirRepCasoUso({
    supabase: db.supabase,
    pagoId: "pago-1",
    usuario: { id: "u1", email: "u1@demo.mx" },
    json,
    resolverFacturapi: () =>
      Promise.resolve({ ok: true as const, data: { client: { invoices }, apiKey: "sk_test_x", ambiente: "sandbox" } }),
  });
}

const tomoClaim = (db: ReturnType<typeof fakeDb>) =>
  db.updates.some((u) => typeof u.patch.facturapi_rep_id === "string" && String(u.patch.facturapi_rep_id).startsWith("PENDING:"));

Deno.test("paymentSummary divergente: 422 estable y sin reclamar el claim", async () => {
  const db = fakeDb({ facturapiId: "fapi-factura-1" });
  const res = await correr(db, {
    paymentSummary: () => Promise.resolve({ installment: 9, last_balance: 0, amount: 0, currency: "USD", taxes: [] }),
    create: () => Promise.reject(new Error("no debió timbrar")),
  });
  assertEquals(res.status, 422);
  const body = await res.json();
  assertEquals(body.error, COD_REP_RESUMEN_DIVERGENTE);
  assert(body.divergencias.length > 0);
  assertEquals(tomoClaim(db), false);
  // No se muta estado_rep a Error por una divergencia de conciliación.
  assertEquals(db.updates.some((u) => u.patch.estado_rep === "Error"), false);
});

Deno.test("paymentSummary no disponible: 503 recuperable sin mutar estado", async () => {
  const db = fakeDb({ facturapiId: "fapi-factura-1" });
  const res = await correr(db, {
    paymentSummary: () => Promise.reject(new Error("502 bad gateway")),
    create: () => Promise.reject(new Error("no debió timbrar")),
  });
  assertEquals(res.status, 503);
  const body = await res.json();
  assertEquals(body.error, COD_REP_RESUMEN_NO_DISPONIBLE);
  assertEquals(body.retryable, true);
  assertEquals(tomoClaim(db), false);
  assertEquals(db.updates.length, 0);
});

Deno.test("claim ya tomado: 409 y no se llama a FacturAPI", async () => {
  // El update del claim no devuelve fila ⇒ otro proceso lo tiene.
  const db = fakeDb({ updateResultados: [null] });
  let creates = 0;
  const res = await correr(db, { create: () => { creates++; return Promise.reject(new Error("x")); } });
  assertEquals(res.status, 409);
  assertEquals(creates, 0);
});

Deno.test("timbrado pendiente: 202 sin marcar Timbrado ni guardar UUID", async () => {
  const db = fakeDb();
  const res = await correr(db, {
    create: () => Promise.resolve({ id: "fapi-rep-1", uuid: null, status: "pending" }),
  });
  assertEquals(res.status, 202);
  const marcados = db.updates.map((u) => u.patch);
  assertEquals(marcados.some((p) => p.estado_rep === "Timbrado"), false);
  assertEquals(marcados.some((p) => p.uuid_rep != null), false);
  assert(marcados.some((p) => p.facturapi_rep_pendiente_id === "fapi-rep-1"));
});

Deno.test("éxito: persiste Timbrado con uuid, folio y serie", async () => {
  const fetchOriginal = globalThis.fetch;
  globalThis.fetch = () => Promise.resolve(new Response("<xml/>", { status: 200 }));
  try {
    const db = fakeDb();
    const res = await correr(db, {
      create: () =>
        Promise.resolve({ id: "fapi-rep-1", uuid: "UUID-REP", folio_number: 12, series: "P", status: "valid" }),
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
