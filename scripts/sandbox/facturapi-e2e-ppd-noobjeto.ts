/**
 * Prueba Sandbox E2E (OPT-IN) — Factura PPD con concepto gravado (IVA 16%,
 * ObjetoImp 02) + concepto No objeto (ObjetoImp 01), registro de pago y REP por
 * complemento de pagos estructurado (`taxability` = ObjetoImpDR).
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
import { imprimirReporte, validarFacturaPpdMixta, validarRepNoObjeto } from "./facturapi-e2e-validar.ts";

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

/** Etiqueta del intento: hace el guion idempotente y permite limpiar después. */
const TAG = Deno.env.get("FACTURAPI_E2E_TAG") ?? `e2e-ppd-noobjeto-${new Date().toISOString().slice(0, 10)}`;
const LIMPIAR = Deno.env.get("FACTURAPI_E2E_LIMPIAR") === "1";

/** Tasa del concepto gravado (configurable; el no objeto no lleva impuestos). */
const TASA_GRAVADA = Number(Deno.env.get("FACTURAPI_E2E_TASA") ?? String(16 / 100));

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

async function emitirFacturaPpdMixta(): Promise<Cfdi> {
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
    items: [
      {
        quantity: 1,
        product: {
          description: "Flete marítimo (gravado)", product_key: "78101800", unit_key: "E48",
          price: 10000, taxability: "02", taxes: [{ type: "IVA", rate: TASA_GRAVADA }],
        },
      },
      {
        quantity: 1,
        product: {
          description: "Gasto no objeto de impuesto", product_key: "78101800", unit_key: "E48",
          price: 4000, taxability: "01", taxes: [],
        },
      },
    ],
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
      grupos_iva: [{ tasa: TASA_GRAVADA, factor: "Tasa", importe: 10000 }],
      subtotal_factura: 14000,
      total_factura: 15600,
      hay_no_objeto: true,
      objeto_imp_dr: "02",
      importe_no_objeto: 4000,
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

const factura = await emitirFacturaPpdMixta();
console.log(`factura ${factura.id} uuid=${factura.uuid} status=${factura.status}`);
if (!factura.uuid) {
  console.error("La factura quedó pendiente de timbre (status pending): reintenta más tarde con el mismo TAG.");
  Deno.exit(1);
}

const okFactura = imprimirReporte("Factura PPD mixta", validarFacturaPpdMixta(await xmlDe(factura.id)));

const rep = await emitirRep(factura, 7800);
console.log(`rep ${rep.id} uuid=${rep.uuid} status=${rep.status}`);
const okRep = rep.uuid
  ? imprimirReporte("REP (estructurado)", validarRepNoObjeto(await xmlDe(rep.id), "02"))
  : (console.error("El REP quedó pendiente de timbre; reintenta con el mismo TAG."), false);

if (LIMPIAR) await limpiar([rep.id, factura.id]);

console.log(`\nRESULTADO: ${okFactura && okRep ? "TODO PASA" : "HAY FALLAS"} (tag=${TAG})`);
Deno.exit(okFactura && okRep ? 0 : 1);
