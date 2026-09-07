import { supabase } from "@/integrations/supabase/client";
import { fromDb, fromDbChecked } from "@/lib/supabase/cast";
import { proformaRowsDbSchema } from "@/features/cotizacion/services/readSchemas";

import { unwrap, unwrapOr } from "@/lib/supabase/response";
import { mergeProformaDetalle } from "./queries.helpers";
import type {
  ConceptoVentaRow,
  ProformaConFactura,
  ProformaConceptoConsolidadoRow,
  ProformaDetalleFull,
  ProformaPendienteConEmbarque,
} from "./types";

/**
 * O8 (auditoría 2026-07-29): selects explícitos por caso de uso.
 * PROFORMA_LISTA_SELECT cubre la bandeja unificada `/proformas`
 * (TabProformas + filtros + CSV). PROFORMA_EMBARQUE_SELECT cubre el tab de
 * facturación del embarque. Si una pantalla necesita otra columna,
 * añadirla aquí con su consumidor en el comentario — no volver a `*`.
 */
const PROFORMA_LISTA_SELECT = [
  "id", "numero", "expediente", "embarque_id", "cliente_id", "cliente_nombre", "operador",
  "dias_credito", "organization_id",
  "subtotal_usd", "iva_usd", "total_usd", "subtotal_mxn", "iva_mxn", "total_mxn",
  "fecha_emision", "estado_proforma", "estado_cliente", "folio_factura_externa",
  "fecha_facturacion", "factura_id", "created_at",
  "facturas:factura_id(factura_pdf_url, factura_xml_url)",
  // R170-01: facturas reales (FK inversa), sólo para distinguir en la lista
  // una conversión a factura BORRADOR de una emisión fiscal real (ver
  // `etiquetaCicloProforma.ts`). Se filtran las borradas (`deleted_at`) en
  // cliente, igual que hace `fetchProformaPorId`.
  "facturas_asociadas:facturas!proforma_id(id, estado, uuid_fiscal, deleted_at)",
].join(", ");

const PROFORMA_EMBARQUE_SELECT = [
  "id", "numero", "embarque_id", "factura_id",
  "estado_proforma", "estado_revision", "estado_aprobacion", "estado_cliente",
  "motivo_rechazo", "rechazada_at", "consolidada_en",
  // R170-03: HistorialProformas (tab facturación del embarque) muestra fecha,
  // operador y días de crédito por fila; sin estas columnas el select nunca
  // las trae y la tabla las pinta como '-'/'—'.
  "fecha_emision", "operador", "dias_credito",
  "total_mxn", "total_usd", "created_at",
  "facturas:factura_id(factura_pdf_url, factura_xml_url)",
].join(", ");

export async function fetchProformasEmbarque(embarqueId: string): Promise<ProformaConFactura[]> {
  // M2: boundary de dinero validado (identidad + total/subtotal/iva).
  return fromDbChecked<ProformaConFactura[]>(
    await unwrapOr(
      supabase
        .from("proformas")
        .select(PROFORMA_EMBARQUE_SELECT)
        .eq("embarque_id", embarqueId)
        // Las proformas en papelera (`deleted_at`) no deben listarse: se veían
        // como vivas y al intentar borrarlas de nuevo el RPC respondía
        // "Registro no encontrado o ya borrado".
        .is("deleted_at", null)
        .order("created_at", { ascending: false }),
      [],
    ),
    proformaRowsDbSchema,
  );

}

export async function fetchProformaPorId(id: string): Promise<ProformaDetalleFull | null> {
  const data = await unwrap(
    supabase
      .from("proformas")
      .select(
        [
          "*",
          "facturas:factura_id(factura_pdf_url, factura_xml_url)",
          "facturas_asociadas:facturas!proforma_id(id, numero, estado, total, moneda, fecha_emision, uuid_fiscal, factura_pdf_url, factura_xml_url, deleted_at, created_at)",
          "cliente_full:cliente_id(nombre, rfc, direccion, ciudad, estado, cp, dias_credito)",
          "envios:proforma_envios(created_at, estado, destinatarios)",
          "embarque_full:embarque_id(modo, tipo, incoterm, bl_house, puerto_origen, puerto_destino, aeropuerto_origen, aeropuerto_destino, ciudad_origen, ciudad_destino, descripcion_mercancia, contenedores:embarque_contenedores(numero_contenedor, tipo_contenedor))",
        ].join(", "),
      )
      .eq("id", id)
      // Una proforma en papelera se trata como inexistente en el detalle; la
      // recuperación vive en `/admin/papelera`.
      .is("deleted_at", null)
      .maybeSingle(),
  );
  if (!data) return null;
  return fromDb<ProformaDetalleFull>(mergeProformaDetalle(data));
}


/**
 * Trae TODAS las proformas de la organización (pendientes, aprobadas y
 * facturadas). Usado por el listado unificado `/proformas` donde el usuario
 * filtra por estado en la UI. No filtra por `estado_revision`.
 */
export async function fetchProformasTodas(organizationId: string): Promise<ProformaConFactura[]> {
  const rows = fromDb<ProformaConFactura[]>(
    await unwrapOr(
      supabase
        .from("proformas")
        .select(PROFORMA_LISTA_SELECT)
        .eq("organization_id", organizationId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false }),
      [],
    ),
  );
  // R170-01: descartar facturas asociadas en papelera; no deben contar para
  // decidir si la conversión ya tiene una factura viva.
  return rows.map((p) => ({
    ...p,
    facturas_asociadas: (p.facturas_asociadas ?? []).filter((f) => !f.deleted_at),
  }));
}


export async function fetchProformasPendientes(
  organizationId: string,
): Promise<ProformaPendienteConEmbarque[]> {
  // Trae también los conceptos_venta con su contenedor hijo asignado, para que el
  // agrupador en cliente pueda separar correctamente proformas de embarques con
  // múltiples contenedores (modelo 1↔N v12.10).
  const data = await unwrapOr(
    supabase
      .from("proformas")
      .select(
        "*, embarques:embarque_id(expediente, bl_master, cliente_nombre, contenedor, tipo_contenedor), conceptos_venta(contenedor_id, embarque_contenedores:contenedor_id(numero_contenedor, tipo_contenedor))",
      )
      .eq("organization_id", organizationId)
      .eq("estado_revision", "pendiente")
      .neq("estado_proforma", "facturada")
      .is("factura_id", null)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    [],
  );

  // Derivar `contenedores_lista` (única por numero_contenedor) por proforma.
  type RawProforma = ProformaPendienteConEmbarque & {
    conceptos_venta?: Array<{
      contenedor_id: string | null;
      embarque_contenedores: { numero_contenedor: string; tipo_contenedor: string } | null;
    }> | null;
  };
  const enriched = data.map((p) => {
    const raw = p as RawProforma;
    const seen = new Set<string>();
    const lista: { numero: string | null; tipo: string | null }[] = [];
    for (const cv of raw.conceptos_venta ?? []) {
      const numero = cv.embarque_contenedores?.numero_contenedor?.trim() || null;
      const tipo = cv.embarque_contenedores?.tipo_contenedor?.trim() || null;
      const key = numero ?? "__sin__";
      if (seen.has(key)) continue;
      seen.add(key);
      lista.push({ numero, tipo });
    }
    return { ...raw, contenedores_lista: lista } as ProformaPendienteConEmbarque;
  });
  return fromDb<ProformaPendienteConEmbarque[]>(enriched);
}

export { fetchClienteParaPdf, fetchEmbarqueParaPdf } from "./queries.pdf";


export async function fetchConceptosProforma(proformaId: string): Promise<ConceptoVentaRow[]> {
  // B-4: incluir info del contenedor real (vía FK conceptos_venta.contenedor_id → embarque_contenedores)
  // para que el PDF agrupe por contenedor cuando el embarque es multi-contenedor.
  return fromDb<ConceptoVentaRow[]>(
    await unwrapOr(
      supabase
        .from("conceptos_venta")
        .select("*, embarque_contenedores:contenedor_id(id, numero_contenedor, tipo_contenedor)")
        .eq("proforma_id", proformaId)
        .is("deleted_at", null),
      [],
    ),
  );
}

export async function fetchConceptosConsolidados(
  proformaId: string,
): Promise<ProformaConceptoConsolidadoRow[]> {
  return unwrapOr(
    supabase.from("proforma_conceptos_consolidados").select("*").is("deleted_at", null).eq("proforma_id", proformaId),
    [] as ProformaConceptoConsolidadoRow[],
  ) as Promise<ProformaConceptoConsolidadoRow[]>;
}
