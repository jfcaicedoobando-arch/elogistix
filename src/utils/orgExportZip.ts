import JSZip from "jszip";
import { saveAs } from "file-saver";
import { supabase } from "@/integrations/supabase/client";

/**
 * Tablas exportadas como CSV en el ZIP de la organización.
 * Cada entry: nombre del archivo y tabla origen.
 * Todas filtran por organization_id vía RLS + filtro explícito.
 */
export const EXPORT_TABLES = [
  "clientes",
  "proveedores",
  "contactos_cliente",
  "embarques",
  "conceptos_costo",
  "conceptos_venta",
  "documentos_embarque",
  "eventos_embarque",
  "notas_embarque",
  "cotizaciones",
  "cotizacion_costos",
  "facturas",
  "conceptos_factura",
  "proformas",
  "proforma_conceptos_consolidados",
  "bitacora_actividad",
  "configuracion",
  "notificaciones_cliente",
] as const;

export type ExportTable = (typeof EXPORT_TABLES)[number];

export interface ExportProgress {
  step: number;
  total: number;
  current: string;
  rows: number;
}

export type ProgressCallback = (p: ExportProgress) => void;

/** Convierte un array de objetos a CSV (RFC 4180 simplificado). */
export function toCSV(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Array.from(
    rows.reduce<Set<string>>((set, row) => {
      Object.keys(row).forEach((k) => set.add(k));
      return set;
    }, new Set()),
  );
  const escape = (v: unknown): string => {
    if (v === null || v === undefined) return "";
    const s = typeof v === "object" ? JSON.stringify(v) : String(v);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => escape(row[h])).join(","));
  }
  return lines.join("\n");
}

/**
 * Genera y descarga un ZIP con todos los datos de la organización en CSV.
 * Pagina cada tabla en bloques de 1000 filas (límite Supabase).
 */
export async function exportOrganizationZip(
  organizationId: string,
  orgNombre: string,
  onProgress?: ProgressCallback,
): Promise<void> {
  const zip = new JSZip();
  const folder = zip.folder(`export-${orgNombre.replace(/[^a-z0-9]/gi, "_")}`)!;
  const total = EXPORT_TABLES.length + 1;
  const PAGE = 1000;

  for (let i = 0; i < EXPORT_TABLES.length; i++) {
    const table = EXPORT_TABLES[i];
    onProgress?.({ step: i + 1, total, current: table, rows: 0 });

    const allRows: Record<string, unknown>[] = [];
    let from = 0;
    // Paginar hasta agotar la tabla
    // (RLS asegura aislamiento, pero filtramos explícitamente por seguridad)
    while (true) {
      const { data, error } = await supabase
        .from(table as ExportTable)
        .select("*")
        .eq("organization_id", organizationId)
        .range(from, from + PAGE - 1);
      if (error) throw new Error(`${table}: ${error.message}`);
      const page = (data ?? []) as Record<string, unknown>[];
      allRows.push(...page);
      onProgress?.({ step: i + 1, total, current: table, rows: allRows.length });
      if (page.length < PAGE) break;
      from += PAGE;
    }
    folder.file(`${table}.csv`, toCSV(allRows));
  }

  // Metadata
  onProgress?.({ step: total, total, current: "manifest.json", rows: 0 });
  folder.file(
    "manifest.json",
    JSON.stringify(
      {
        organization_id: organizationId,
        organization_nombre: orgNombre,
        generated_at: new Date().toISOString(),
        tables: EXPORT_TABLES,
        format: "CSV (RFC 4180 simplificado)",
        note: "Export generado client-side desde Lovable Cloud. Filas paginadas a 1000 por petición.",
      },
      null,
      2,
    ),
  );

  const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });
  const fecha = new Date().toISOString().slice(0, 10);
  saveAs(blob, `libre-carga-export-${orgNombre.replace(/[^a-z0-9]/gi, "_")}-${fecha}.zip`);
}
