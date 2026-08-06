/**
 * Lógica del backfill: copia archivos del buzón (`cxp-inbox`) al bucket
 * `facturas` de la factura de proveedor y siembra los conceptos del CFDI.
 * Idempotente: sólo toca lo que está vacío.
 */
// @ts-expect-error Deno remote import
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { parseConceptosCfdi } from "./cfdiConceptos.ts";

const BUCKET_INBOX = "cxp-inbox";
const BUCKET_FACTURAS = "facturas";

interface DocRow {
  id: string;
  organization_id: string;
  proveedor_factura_id: string;
  archivo_path: string | null;
  nombre_archivo: string | null;
  xml_path: string | null;
  xml_nombre: string | null;
}

interface FacturaRow {
  id: string;
  organization_id: string;
  archivo_pdf_url: string | null;
  archivo_xml_url: string | null;
  deleted_at: string | null;
}

export interface ResultadoFactura {
  factura_id: string;
  pdf: boolean;
  xml: boolean;
  conceptos: number;
  error?: string;
}

function sanitize(nombre: string): string {
  return nombre
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(-120);
}

async function copiarArchivo(
  admin: SupabaseClient,
  params: {
    origen: string;
    nombre: string;
    organizationId: string;
    facturaId: string;
    tipo: "PDF" | "XML";
  },
): Promise<string> {
  const bajada = await admin.storage.from(BUCKET_INBOX).download(params.origen);
  if (bajada.error) throw bajada.error;
  const destino =
    `${params.organizationId}/cfdi/${params.facturaId}/${sanitize(params.nombre)}`;
  const subida = await admin.storage.from(BUCKET_FACTURAS).upload(destino, bajada.data, {
    contentType: params.tipo === "XML" ? "application/xml" : "application/pdf",
    upsert: true,
  });
  if (subida.error) throw subida.error;
  return destino;
}

async function sembrarConceptos(
  admin: SupabaseClient,
  doc: DocRow,
  factura: FacturaRow,
): Promise<number> {
  const { count, error: errCount } = await admin
    .from("proveedor_facturas_conceptos")
    .select("id", { count: "exact", head: true })
    .eq("proveedor_factura_id", factura.id);
  if (errCount) throw errCount;
  if ((count ?? 0) > 0 || !doc.xml_path) return 0;

  const bajada = await admin.storage.from(BUCKET_INBOX).download(doc.xml_path);
  if (bajada.error) throw bajada.error;
  const conceptos = parseConceptosCfdi(await bajada.data.text());
  if (!conceptos.length) return 0;

  const rows = conceptos.map((c) => ({
    proveedor_factura_id: factura.id,
    organization_id: factura.organization_id,
    concepto_costo_id: null,
    descripcion: c.descripcion.slice(0, 500),
    cantidad: c.cantidad,
    clave_unidad: c.clave_unidad || null,
    monto: c.importe,
    iva: c.iva,
    ieps: c.ieps,
  }));
  const { error } = await admin.from("proveedor_facturas_conceptos").insert(rows);
  if (error) throw error;
  return rows.length;
}

async function procesarDoc(
  admin: SupabaseClient,
  doc: DocRow,
): Promise<ResultadoFactura | null> {
  const { data: factura, error } = await admin
    .from("proveedor_facturas")
    .select("id, organization_id, archivo_pdf_url, archivo_xml_url, deleted_at")
    .eq("id", doc.proveedor_factura_id)
    .maybeSingle();
  if (error) throw error;
  const f = factura as FacturaRow | null;
  if (!f || f.deleted_at) return null;

  const patch: { archivo_pdf_url?: string; archivo_xml_url?: string } = {};
  if (!f.archivo_pdf_url && doc.archivo_path && !doc.archivo_path.toLowerCase().endsWith(".xml")) {
    patch.archivo_pdf_url = await copiarArchivo(admin, {
      origen: doc.archivo_path,
      nombre: doc.nombre_archivo ?? "factura.pdf",
      organizationId: f.organization_id,
      facturaId: f.id,
      tipo: "PDF",
    });
  }
  if (!f.archivo_xml_url && doc.xml_path) {
    patch.archivo_xml_url = await copiarArchivo(admin, {
      origen: doc.xml_path,
      nombre: doc.xml_nombre ?? "factura.xml",
      organizationId: f.organization_id,
      facturaId: f.id,
      tipo: "XML",
    });
  }
  if (Object.keys(patch).length > 0) {
    const { error: errUpd } = await admin
      .from("proveedor_facturas")
      .update(patch)
      .eq("id", f.id);
    if (errUpd) throw errUpd;
  }

  const conceptos = await sembrarConceptos(admin, doc, f);
  if (!patch.archivo_pdf_url && !patch.archivo_xml_url && conceptos === 0) return null;
  return {
    factura_id: f.id,
    pdf: Boolean(patch.archivo_pdf_url),
    xml: Boolean(patch.archivo_xml_url),
    conceptos,
  };
}

export async function ejecutarBackfill(
  admin: SupabaseClient,
  opciones: { facturaId?: string | null } = {},
): Promise<{ revisados: number; cambiados: ResultadoFactura[]; errores: ResultadoFactura[] }> {
  let query = admin
    .from("embarque_facturas_entrantes")
    .select(
      "id, organization_id, proveedor_factura_id, archivo_path, nombre_archivo, xml_path, xml_nombre",
    )
    .eq("estado", "capturada")
    .is("deleted_at", null)
    .not("proveedor_factura_id", "is", null);
  if (opciones.facturaId) query = query.eq("proveedor_factura_id", opciones.facturaId);

  const { data, error } = await query;
  if (error) throw error;
  const docs = (data ?? []) as DocRow[];

  const cambiados: ResultadoFactura[] = [];
  const errores: ResultadoFactura[] = [];
  for (const doc of docs) {
    try {
      const r = await procesarDoc(admin, doc);
      if (r) cambiados.push(r);
    } catch (e) {
      errores.push({
        factura_id: doc.proveedor_factura_id,
        pdf: false,
        xml: false,
        conceptos: 0,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }
  return { revisados: docs.length, cambiados, errores };
}
