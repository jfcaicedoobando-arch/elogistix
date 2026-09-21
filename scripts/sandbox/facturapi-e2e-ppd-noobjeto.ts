/**
 * Prueba Sandbox E2E (OPT-IN) — Factura PPD con conceptos No objeto (ObjetoImp
 * 01), registro de pago y REP por complemento de pagos estructurado
 * (`taxability` = ObjetoImpDR).
 *
 * Escenarios (FACTURAPI_E2E_ESCENARIO):
 *   B (default) — factura mixta: gravado IVA 16% + no objeto ⇒ ObjetoImpDR 02
 *                 con un solo TrasladoDR sobre base gravada prorrateada.
 *   A           — factura 100% no objeto ⇒ ObjetoImpDR 01 sin ImpuestosDR.
 *
 * NUNCA corre en CI: no es un `*_test.ts`, exige variables explícitas de
 * sandbox y aborta si la llave no es de pruebas. No hay credenciales en el
 * repo.
 *
 * Uso e interpretación: `docs/facturapi-sandbox-e2e.md`.
 *
 *   FACTURAPI_SANDBOX_E2E=1 FACTURAPI_SANDBOX_KEY=sk_test_... \
 *     deno run --allow-env --allow-net scripts/sandbox/facturapi-e2e-ppd-noobjeto.ts
 */
import { buildRepPayload, type PagoContext } from "../../supabase/functions/facturapi-emitir-rep/helpers.ts";
import { round2 } from "../../supabase/functions/facturapi-emitir-rep/taxesDr.ts";
import { imprimirReporte, validarFacturaPpd, validarRepNoObjeto } from "./facturapi-e2e-validar.ts";

const API = "https://www.facturapi.io/v2";

function requerido(nombre: string): string {
  const v = Deno.env.get(nombre);
  if (!v) {
    console.error(
      `Falta ${nombre}. Esta prueba es opt-in contra el sandbox de FacturAPI; ` +
      "ver docs/facturapi-sandbox-e2e.md.",
    );
    Deno.exit(2);
  }
  return v;
}

const KEY = (() => {
  requerido("FACTURAPI_SANDBOX_E2E");
  const key = requerido("FACTURAPI_SANDBOX_KEY");
  if (!key.startsWith("sk_test")) {
    console.error("La llave NO es de sandbox (debe iniciar con sk_test). Abortado por seguridad.");
    Deno.exit(2);
  }
  return key;
})();

/** Escenario: A = 100% no objeto (ObjetoImpDR 01); B = mixto (ObjetoImpDR 02). */
const ESCENARIO = (Deno.env.get("FACTURAPI_E2E_ESCENARIO") ?? "B").toUpperCase() === "A" ? "A" : "B";
const OBJETO_IMP_DR: "01" | "02" = ESCENARIO === "A" ? "01" : "02";

/** Etiqueta del intento: hace el guion idempotente y permite limpiar después. */
const TAG = Deno.env.get("FACTURAPI_E2E_TAG") ??
  `e2e-ppd-noobjeto-${ESCENARIO}-${new Date().toISOString().slice(0, 10)}`;
const LIMPIAR = Deno.env.get("FACTURAPI_E2E_LIMPIAR") === "1";

/** Tasa del concepto gravado (configurable; el no objeto no lleva impuestos). */
const TASA_GRAVADA = Number(Deno.env.get("FACTURAPI_E2E_TASA") ?? String(16 / 100));

/** Importes fijos del escenario (subtotal gravado / no objeto / total con IVA). */
const GRAVADO = ESCENARIO === "A" ? 0 : 10000;
const NO_OBJETO = 4000;
const SUBTOTAL = GRAVADO + NO_OBJETO;
const TOTAL = round2(SUBTOTAL + GRAVADO * TASA_GRAVADA);
/** Pago parcial: la mitad del total, para ejercitar el prorrateo del REP. */
const MONTO_PAGO = round2(TOTAL / 2);

const auth = "Basic " + btoa(`${KEY}:`);

async function api<T>(metodo: string, ruta: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API}${ruta}`, {
    method: metodo,
    headers: { Authorization: auth, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const texto = await res.text();
  if (!res.ok) throw new Error(`${metodo} ${ruta} → ${res.status} ${texto}`);
  return (texto ? JSON.parse(texto) : {}) as T;
}

async function xmlDe(id: string): Promise<string> {
  const res = await fetch(`${API}/invoices/${id}/xml`, { headers: { Authorization: auth } });
  if (!res.ok) throw new Error(`XML ${id} → ${res.status}`);
  return await res.text();
}

interface Cfdi { id: string; uuid?: string | null; status?: string; external_id?: string }

/** Idempotencia: si el intento ya existe (mismo external_id) se reutiliza. */
async function buscarPorExternalId(externalId: string): Promise<Cfdi | null> {
  const r = await api<{ data?: Cfdi[] }>("GET", `/invoices?q=${encodeURIComponent(externalId)}&limit=50`);
  return (r.data ?? []).find((f) => f.external_id === externalId) ?? null;
}

const RECEPTOR = {
  legal_name: "PRUEBAS SANDBOX LIBRE CARGA",
  tax_id: "XAXX010101000",
  tax_system: "616",
  address: { zip: "64000" },
};

function conceptos() {
  const noObjeto = {
    quantity: 1,
    product: {
      description: "Gasto no objeto de impuesto", product_key: "78101800", unit_key: "E48",
      price: NO_OBJETO, taxability: "01", taxes: [] as unknown[],
    },
  };
  if (ESCENARIO === "A") return [noObjeto];
  return [
    {
      quantity: 1,
      product: {
        description: "Flete marítimo (gravado)", product_key: "78101800", unit_key: "E48",
        price: GRAVADO, taxability: "02", taxes: [{ type: "IVA", rate: TASA_GRAVADA }],
      },
    },
    noObjeto,
  ];
}

async function emitirFacturaPpd(): Promise<Cfdi> {
  const externalId = `${TAG}-I`;
  const previa = await buscarPorExternalId(externalId);
  if (previa) return previa;
  return await api<Cfdi>("POST", "/invoices", {
    type: "I",
    customer: RECEPTOR,
    payment_form: "99",   // PPD sin pago recibido ⇒ FormaPago 99
    payment_method: "PPD", // PPD es del CFDI completo, no del concepto
    external_id: externalId,
    idempotency_key: externalId,
    items: conceptos(),
  });
}

interface ResumenPago { installment: number; last_balance: number; amount: number; currency: string; taxes: unknown[] }

async function emitirRep(factura: Cfdi, montoPago: number): Promise<Cfdi> {
  const externalId = `${TAG}-P`;
  const previa = await buscarPorExternalId(externalId);
  if (previa) return previa;

  // P1: el resumen del proveedor es la autoridad del saldo (moneda de la factura).
  const resumen = await api<ResumenPago>(
    "GET", `/invoices/${factura.id}/payment-summary?amount=${montoPago}`,
  );
  console.log("paymentSummary:", resumen);

  const ctx: PagoContext = {
    receptor: RECEPTOR,
    fecha_pago: new Date().toISOString().slice(0, 10),
    forma_pago: "03",
    moneda: resumen.currency ?? "MXN",
    tipo_cambio: 1,
    monto: montoPago,
    documento_relacionado: {
      uuid: String(factura.uuid ?? ""),
      moneda_dr: resumen.currency ?? "MXN",
      tipo_cambio_dr: 1,
      num_parcialidad: resumen.installment,
      imp_saldo_ant: resumen.last_balance,
      imp_pagado: resumen.amount,
      imp_saldo_insoluto: round2(resumen.last_balance - resumen.amount),
      metodo_pago: "PPD",
      tasa_iva: TASA_GRAVADA,
      factor_iva: "Tasa",
      grupos_iva: ESCENARIO === "A" ? [] : [{ tasa: TASA_GRAVADA, factor: "Tasa", importe: GRAVADO }],
      subtotal_factura: SUBTOTAL,
      total_factura: TOTAL,
      hay_no_objeto: true,
      objeto_imp_dr: OBJETO_IMP_DR,
      importe_no_objeto: NO_OBJETO,
    },
  };
  const payload = Object.assign(buildRepPayload(ctx), {
    external_id: externalId, idempotency_key: externalId,
  });
  return await api<Cfdi>("POST", "/invoices", payload);
}

async function limpiar(ids: string[]): Promise<void> {
  for (const id of ids) {
    try {
      await api("DELETE", `/invoices/${id}?motive=02`);
      console.log(`cancelado ${id}`);
    } catch (e) {
      console.warn(`no se pudo cancelar ${id}:`, (e as Error).message);
    }
  }
}

console.log(`escenario=${ESCENARIO} (ObjetoImpDR esperado ${OBJETO_IMP_DR}) tag=${TAG}`);
const factura = await emitirFacturaPpd();
console.log(`factura ${factura.id} uuid=${factura.uuid} status=${factura.status}`);
if (!factura.uuid) {
  console.error("La factura quedó pendiente de timbre (status pending): reintenta más tarde con el mismo TAG.");
  Deno.exit(1);
}

const okFactura = imprimirReporte(
  `Factura PPD (${ESCENARIO})`,
  validarFacturaPpd(await xmlDe(factura.id), ESCENARIO === "B"),
);

const rep = await emitirRep(factura, MONTO_PAGO);
console.log(`rep ${rep.id} uuid=${rep.uuid} status=${rep.status}`);
const okRep = rep.uuid
  ? imprimirReporte("REP (estructurado)", validarRepNoObjeto(await xmlDe(rep.id), OBJETO_IMP_DR))
  : (console.error("El REP quedó pendiente de timbre; reintenta con el mismo TAG."), false);

if (LIMPIAR) await limpiar([rep.id, factura.id]);

console.log(`\nRESULTADO: ${okFactura && okRep ? "TODO PASA" : "HAY FALLAS"} (tag=${TAG})`);
Deno.exit(okFactura && okRep ? 0 : 1);
