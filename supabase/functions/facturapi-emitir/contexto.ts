/**
 * Carga y validación del CONTEXTO fiscal de la factura (cliente, conceptos
 * vigentes y referencias del embarque) antes de armar el payload del SAT.
 * Extraído de `emitir.ts` para respetar el límite de líneas por archivo.
 */
import { type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { jsonResponse } from "../_shared/response.ts";
import { validateContext, type FacturaContext } from "./helpers.ts";
import type { FacturaRow } from "./types.ts";

interface ClienteRow { id: string; nombre: string; rfc?: string | null; codigo_postal?: string | null; regimen_fiscal?: string | null; uso_cfdi_default?: string | null }
interface ConceptoRow {
  descripcion: string; cantidad: number | string; precio_unitario: number | string;
  clave_sat?: string | null; clave_unidad?: string | null; tipo_iva?: string | null;
  tasa_iva_aplicada?: number | string | null; tasa_ret_isr?: number | string | null; tasa_ret_iva?: number | string | null;
}

interface BaseContexto {
  cliente: ClienteRow;
  contactoEmail: string | null;
  conceptos: FacturaContext["conceptos"];
}

export async function cargarContexto(
  supabase: SupabaseClient, facturaId: string, factura: FacturaRow, sustituyeUuid: string | null,
): Promise<FacturaContext | Response> {
  const base = await cargarBaseContexto(supabase, facturaId, factura);
  if (base instanceof Response) return base;
  const refs = await cargarReferenciasEmbarque(supabase, factura);
  const ctx: FacturaContext = {
    serie: factura.serie ?? null,
    forma_pago: factura.forma_pago ?? "",
    metodo_pago: factura.metodo_pago ?? "PUE",
    uso_cfdi: factura.uso_cfdi ?? base.cliente.uso_cfdi_default ?? "",
    moneda: factura.moneda ?? "MXN",
    tipo_cambio: Number(factura.tipo_cambio ?? 1),
    receptor: { legal_name: base.cliente.nombre, tax_id: factura.rfc_cliente ?? base.cliente.rfc ?? "", tax_system: base.cliente.regimen_fiscal ?? "", address: { zip: base.cliente.codigo_postal ?? "" }, email: base.contactoEmail },
    conceptos: base.conceptos,
    sustituye_uuid: sustituyeUuid,
    referencias: refs,
    // REF-06: se asigna en index.ts DESPUÉS de tomar el claim (el claim ya no
    // existe al construir el contexto; así las validaciones 422 no necesitan
    // liberarlo).
    external_id: null,
  };

  const issues = validateContext(ctx);
  if (issues.length > 0) return jsonResponse({ error: "validation_failed", issues }, 422);
  return ctx;
}

/**
 * BUG-01: el payload que se manda al SAT debe cuadrar con la cabecera guardada.
 * Si la suma de los conceptos vigentes se separa más de $1 del subtotal de la
 * factura, algo quedó desincronizado (conceptos borrados, edición a medias) y
 * preferimos NO timbrar.
 */
function validarCuadreSubtotal(conceptos: ConceptoRow[], factura: FacturaRow): Response | null {
  const subtotalHeader = factura.subtotal != null ? Number(factura.subtotal) : null;
  if (subtotalHeader == null || !Number.isFinite(subtotalHeader)) return null;
  const suma = conceptos.reduce((acc, c) => acc + Number(c.cantidad) * Number(c.precio_unitario), 0);
  if (Math.abs(suma - subtotalHeader) <= 1) return null;
  return jsonResponse({
    error: "subtotal_descuadrado",
    message: `Los conceptos vigentes suman ${suma.toFixed(2)} pero la factura tiene un subtotal de ${subtotalHeader.toFixed(2)}. Revisa los conceptos antes de timbrar.`,
  }, 422);
}

async function cargarBaseContexto(supabase: SupabaseClient, facturaId: string, factura: FacturaRow): Promise<BaseContexto | Response> {
  const { data: cliente, error: cErr } = await supabase
    .from("clientes")
    .select("id, nombre, rfc, codigo_postal, regimen_fiscal, uso_cfdi_default")
    .eq("id", factura.cliente_id)
    .maybeSingle();
  if (cErr || !cliente) return jsonResponse({ error: "cliente_not_found", detail: cErr?.message }, 404);

  const { data: conceptos, error: conErr } = await supabase
    .from("conceptos_factura")
    .select("descripcion, cantidad, precio_unitario, clave_sat, clave_unidad, tipo_iva, tasa_iva_aplicada, tasa_ret_isr, tasa_ret_iva")
    .eq("factura_id", facturaId)
    // BUG-01 (auditoría 2026-08-18): los conceptos en papelera NO se timbran.
    .is("deleted_at", null);
  if (conErr) return jsonResponse({ error: "conceptos_query_failed", detail: conErr.message }, 500);

  if ((conceptos ?? []).length === 0) {
    return jsonResponse({ error: "sin_conceptos", message: "La factura no tiene conceptos vigentes; no se puede timbrar." }, 422);
  }

  const cuadre = validarCuadreSubtotal(conceptos ?? [], factura);
  if (cuadre) return cuadre;

  const conceptosSinClave = (conceptos ?? []).filter((c) => !c.clave_sat || String(c.clave_sat).trim() === "");
  if (conceptosSinClave.length > 0) {
    return jsonResponse({ error: "clave_sat_faltante", message: `Hay ${conceptosSinClave.length} concepto(s) sin clave SAT (c_ClaveProdServ). Asigna la clave correcta antes de timbrar.` }, 422);
  }

  // La columna `es_principal` fue removida; tomamos el contacto más antiguo con email.
  const { data: contactoData } = await supabase
    .from("contactos_cliente")
    .select("email")
    .eq("cliente_id", factura.cliente_id)
    .not("email", "is", null)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  return {
    cliente,
    contactoEmail: contactoData?.email ?? null,
    conceptos: (conceptos ?? []).map((c) => ({
      descripcion: c.descripcion, cantidad: Number(c.cantidad), precio_unitario: Number(c.precio_unitario), clave_sat: c.clave_sat,
      clave_unidad: c.clave_unidad ?? "E48", unidad: "Unidad de servicio",
      tipo_iva: (c.tipo_iva as "gravado_16" | "tasa_0" | "exento" | null) ?? "gravado_16",
      tasa_iva: c.tasa_iva_aplicada != null ? Number(c.tasa_iva_aplicada) : 0.16,
      tasa_ret_isr: c.tasa_ret_isr != null ? Number(c.tasa_ret_isr) : 0,
      tasa_ret_iva: c.tasa_ret_iva != null ? Number(c.tasa_ret_iva) : 0,
    })),
  };
}

async function cargarReferenciasEmbarque(supabase: SupabaseClient, factura: FacturaRow): Promise<FacturaContext["referencias"]> {
  let refExpediente: string | null = factura.expediente ?? null;
  let refBlMaster: string | null = null;
  let refBlHouse: string | null = factura.referencia_bl ?? null;
  if (factura.embarque_id) {
    const { data: emb } = await supabase.from("embarques").select("expediente, bl_master, bl_house").eq("id", factura.embarque_id).maybeSingle();
    if (emb) { refExpediente = emb.expediente ?? refExpediente; refBlMaster = emb.bl_master ?? null; refBlHouse = emb.bl_house ?? refBlHouse; }
  }
  return { expediente: refExpediente, bl_master: refBlMaster, bl_house: refBlHouse };
}
