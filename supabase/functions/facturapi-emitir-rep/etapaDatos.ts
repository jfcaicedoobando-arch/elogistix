/**
 * Etapa 1 — Carga de la factura relacionada y del contexto de datos del pago.
 *
 * Extraído de `index.ts` sin cambiar consultas, columnas, códigos HTTP ni
 * textos: mismas validaciones (factura existente, timbrada y PPD) y mismo orden
 * de lecturas (cliente, contacto, pagos previos, notas de crédito, embarque).
 */
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { calcularParcialidad, resolverReferenciasEmbarque, type ParcialidadInfo, type RefsEmbarque } from "./context.ts";
import { ncAplicadasEnMonedaFactura } from "./ncDr.ts";
import { etapaCorte, etapaOk, type Etapa, type JsonFn } from "./etapaResultado.ts";

const COLS_FACTURA =
  "id, numero, serie, total, subtotal, iva, moneda, tipo_cambio, metodo_pago, uuid_fiscal, folio_fiscal, cliente_id, rfc_cliente, embarque_id, expediente, referencia_bl, facturapi_id";

export interface FacturaRep {
  id: string;
  numero?: string | null;
  serie?: string | null;
  total?: number | null;
  subtotal?: number | null;
  iva?: number | null;
  moneda?: string | null;
  tipo_cambio?: number | null;
  metodo_pago?: string | null;
  uuid_fiscal: string;
  folio_fiscal?: number | string | null;
  cliente_id: string;
  rfc_cliente?: string | null;
  embarque_id?: string | null;
  expediente?: string | null;
  referencia_bl?: string | null;
  facturapi_id?: string | null;
}

/** Pago a timbrar, tal como lo entrega `precargarPagoRep`. */
export interface PagoRep {
  id: string;
  factura_id: string;
  organization_id: string;
  fecha_pago?: string | null;
  monto?: number | null;
  moneda?: string | null;
  tipo_cambio?: number | null;
  forma_pago?: string | null;
  referencia?: string | null;
  monto_aplicado_factura?: number | null;
}

export interface DatosPagoRep {
  cliente: { id: string; nombre: string; rfc?: string | null; codigo_postal?: string | null; regimen_fiscal?: string | null };
  emailContacto: string | null;
  parcialidad: ParcialidadInfo;
  refs: RefsEmbarque;
}

/** Factura relacionada: existe, está timbrada y es PPD. */
export async function cargarFacturaPpd(
  supabase: SupabaseClient,
  facturaId: string,
  json: JsonFn,
): Promise<Etapa<FacturaRep>> {
  const { data: factura, error: fErr } = await supabase
    .from("facturas")
    .select(COLS_FACTURA)
    .eq("id", facturaId)
    .maybeSingle();
  if (fErr || !factura) return etapaCorte(json({ error: "factura_not_found", detail: fErr?.message }, 404));
  const f = factura as unknown as FacturaRep;
  if (!f.uuid_fiscal) {
    return etapaCorte(json({ error: "factura_no_timbrada", message: "La factura original no está timbrada." }, 409));
  }
  if (f.metodo_pago !== "PPD") {
    return etapaCorte(json({ error: "no_aplica_rep", message: "La factura no es PPD; no requiere REP." }, 409));
  }
  return etapaOk(f);
}

/** Cliente, contacto, parcialidad (con notas de crédito) y referencias. */
export async function cargarDatosPago(
  supabase: SupabaseClient,
  factura: FacturaRep,
  pago: PagoRep,
  json: JsonFn,
): Promise<Etapa<DatosPagoRep>> {
  const { data: cliente, error: cErr } = await supabase
    .from("clientes")
    .select("id, nombre, rfc, codigo_postal, regimen_fiscal")
    .eq("id", factura.cliente_id)
    .maybeSingle();
  if (cErr || !cliente) return etapaCorte(json({ error: "cliente_not_found", detail: cErr?.message }, 404));

  // La columna `es_principal` fue removida; tomamos el contacto más antiguo con email.
  const { data: contactoData } = await supabase
    .from("contactos_cliente")
    .select("email")
    .eq("cliente_id", factura.cliente_id)
    .not("email", "is", null)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  // Pagos previos de la misma factura para calcular num_parcialidad e imp_saldo_ant.
  const { data: pagosPrev, error: ppErr } = await supabase
    .from("pagos_factura")
    .select("id, fecha_pago, monto_aplicado_factura, created_at")
    .eq("factura_id", factura.id)
    .is("deleted_at", null)
    .order("fecha_pago", { ascending: true })
    .order("created_at", { ascending: true });
  if (ppErr) return etapaCorte(json({ error: "pagos_query_failed", detail: ppErr.message }, 500));

  // Ola E3 · N1 — notas de crédito aplicadas antes de este pago.
  const { data: ncsFactura, error: ncErr } = await supabase
    .from("factura_notas_credito")
    .select("monto, moneda, tipo_cambio, estado, fecha_emision, deleted_at")
    .eq("factura_id", factura.id)
    .is("deleted_at", null);
  if (ncErr) return etapaCorte(json({ error: "nc_query_failed", detail: ncErr.message }, 500));
  const ncAntes = ncAplicadasEnMonedaFactura(
    ncsFactura,
    String(factura.moneda ?? "MXN"),
    Number(factura.tipo_cambio ?? 1),
    typeof pago.fecha_pago === "string" ? pago.fecha_pago : null,
  );

  const parcialidad = calcularParcialidad(
    pagosPrev, pago.id, Number(factura.total ?? 0), Number(pago.monto_aplicado_factura ?? 0), ncAntes,
  );

  // v13.208.0 — Referencias del embarque vinculado a la factura (con fallback a snapshot).
  const refs = await resolverReferenciasEmbarque(supabase, factura);

  return etapaOk({
    cliente: cliente as unknown as DatosPagoRep["cliente"],
    emailContacto: (contactoData as { email?: string | null } | null)?.email ?? null,
    parcialidad,
    refs,
  });
}
