/**
 * Carga y validación del CONTEXTO fiscal de la factura (cliente, conceptos
 * vigentes y referencias del embarque) antes de armar el payload del SAT.
 * Extraído de `emitir.ts` para respetar el límite de líneas por archivo.
 */
import { type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { jsonResponse } from "../_shared/response.ts";
import { resolverConceptosFiscales, type ConceptoRow } from "./conceptosFiscales.ts";
import { validarCuadreFiscal, validarCuadreSubtotal } from "./contextoCuadre.ts";
import { validateContext, type FacturaContext } from "./helpers.ts";
import type { FacturaRow } from "./types.ts";

interface ClienteRow { id: string; nombre: string; rfc?: string | null; codigo_postal?: string | null; regimen_fiscal?: string | null; uso_cfdi_default?: string | null }
// `ConceptoRow` (columnas reales de `conceptos_factura`) vive en
// `conceptosFiscales.ts`. OJO: esa tabla NO tiene `aplica_iva` — el interruptor
// legado sólo existe en `conceptos_venta` y `proforma_conceptos_consolidados`.
// Pedirlo en el select devuelve 400 y mata el timbrado con
// `conceptos_query_failed`: el tratamiento SAT se decide con `tipo_iva`.

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
 * Lee los conceptos vigentes y aplica las defensas previas al SAT:
 * papelera → sin conceptos → cuadre de subtotal → clave SAT.
 *
 * El `.select()` sólo puede pedir columnas que existen en `conceptos_factura`
 * (ver ConceptoRow): una columna inexistente tumba el timbrado con 500.
 */
async function cargarConceptosVigentes(
  supabase: SupabaseClient, facturaId: string, factura: FacturaRow,
): Promise<ConceptoRow[] | Response> {
  const { data: conceptos, error: conErr } = await supabase
    .from("conceptos_factura")
    .select("descripcion, cantidad, precio_unitario, clave_sat, clave_unidad, tipo_iva, tasa_iva_aplicada, tasa_ret_isr, tasa_ret_iva")
    .eq("factura_id", facturaId)
    // BUG-01 (auditoría 2026-08-18): los conceptos en papelera NO se timbran.
    .is("deleted_at", null);
  if (conErr) return jsonResponse({ error: "conceptos_query_failed", detail: conErr.message }, 500);

  const filas = (conceptos ?? []) as ConceptoRow[];
  if (filas.length === 0) {
    return jsonResponse({ error: "sin_conceptos", message: "La factura no tiene conceptos vigentes; no se puede timbrar." }, 422);
  }

  const cuadre = validarCuadreSubtotal(filas, factura);
  if (cuadre) return cuadre;

  const sinClave = filas.filter((c) => !c.clave_sat || String(c.clave_sat).trim() === "");
  if (sinClave.length > 0) {
    return jsonResponse({ error: "clave_sat_faltante", message: `Hay ${sinClave.length} concepto(s) sin clave SAT (c_ClaveProdServ). Asigna la clave correcta antes de timbrar.` }, 422);
  }
  return filas;
}

async function cargarBaseContexto(supabase: SupabaseClient, facturaId: string, factura: FacturaRow): Promise<BaseContexto | Response> {
  const { data: cliente, error: cErr } = await supabase
    .from("clientes")
    .select("id, nombre, rfc, codigo_postal, regimen_fiscal, uso_cfdi_default")
    .eq("id", factura.cliente_id)
    .maybeSingle();
  if (cErr || !cliente) return jsonResponse({ error: "cliente_not_found", detail: cErr?.message }, 404);

  const conceptos = await cargarConceptosVigentes(supabase, facturaId, factura);
  if (conceptos instanceof Response) return conceptos;


  // La columna `es_principal` fue removida; tomamos el contacto más antiguo con email.
  const { data: contactoData } = await supabase
    .from("contactos_cliente")
    .select("email")
    .eq("cliente_id", factura.cliente_id)
    .not("email", "is", null)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  // P1-IVA: la clasificación fiscal del renglón NO se completa con un 16% por
  // omisión. Si el tratamiento explícito y la tasa se contradicen (o el
  // renglón legado es ambiguo), se bloquea el timbrado con un mensaje
  // accionable en vez de emitir un importe distinto al aprobado.
  const conceptosResueltos = resolverConceptosFiscales(conceptos);
  if (conceptosResueltos instanceof Response) return conceptosResueltos;

  const cuadreFiscal = validarCuadreFiscal(conceptosResueltos, factura);
  if (cuadreFiscal) return cuadreFiscal;

  const frontera = await bloquearIvaFrontera(supabase, factura, conceptosResueltos);
  if (frontera) return frontera;

  return {
    cliente,
    contactoEmail: contactoData?.email ?? null,
    conceptos: conceptosResueltos,
  };
}

/**
 * P2-IVA (seguimiento) — la tasa de 8% es un ESTÍMULO FISCAL de la región
 * fronteriza sujeto a aviso y requisitos. Aunque el dato ya esté guardado, no
 * se timbra al 8% mientras Contabilidad no habilite el estímulo en
 * Configuración → Facturación. Fail-closed: sin fila de configuración (o si la
 * consulta falla) se considera deshabilitado.
 */
async function bloquearIvaFrontera(
  supabase: SupabaseClient,
  factura: FacturaRow,
  conceptos: FacturaContext["conceptos"],
): Promise<Response | null> {
  const afectados = conceptos.filter((c) => c.tipo_iva === "gravado_8");
  if (afectados.length === 0) return null;

  const { data, error } = await supabase
    .from("configuracion")
    .select("valor")
    .eq("organization_id", factura.organization_id)
    .eq("categoria", "facturacion")
    .eq("clave", "iva_frontera_habilitado")
    .maybeSingle();
  const valor = error ? null : data?.valor;
  const habilitada = valor === true || valor === "true";
  if (habilitada) return null;

  const nombres = afectados.map((c) => `"${c.descripcion}"`).join(", ");
  return jsonResponse({
    error: "iva_frontera_no_habilitado",
    message:
      `Hay ${afectados.length} concepto(s) con IVA 8% de región fronteriza (${nombres}). ` +
      "El 8% es un estímulo fiscal sujeto a aviso y requisitos ante el SAT: Contabilidad debe " +
      "habilitarlo en Configuración → Facturación después de confirmar la elegibilidad, " +
      "o cambiar el tratamiento fiscal del concepto antes de timbrar.",
  }, 422);
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
