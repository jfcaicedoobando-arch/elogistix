/**
 * Helpers puros (sin side effects de Deno.serve / Sentry) para
 * `auditoria-explicar-hallazgo`. Se extraen para poder testearlos con
 * `deno test` sin botar el servidor HTTP.
 */

export interface DocumentoCtx {
  nombre: string;
  estado: string;
  tiene_archivo: boolean;
}

export interface ContextoEmbarque {
  expediente: string;
  estado: string;
  modo: string;
  cliente: string;
  etd: string | null;
  eta: string | null;
  fecha_llegada_real: string | null;
  conceptos_venta_total: number;
  conceptos_venta_pendientes: number;
  conceptos_venta_facturados: number;
  conceptos_costo_total: number;
  facturas: Array<{ folio: string; estado: string; total: number; moneda: string }>;
  proformas: Array<{ folio: string; estado: string }>;
  documentos: DocumentoCtx[];
}

/** Agrupa documentos por nombre y marca duplicados explícitamente. */
export function formatDocumentos(docs: DocumentoCtx[]): string {
  if (docs.length === 0) return "—";
  const byName = new Map<string, DocumentoCtx[]>();
  for (const d of docs) {
    const arr = byName.get(d.nombre) ?? [];
    arr.push(d);
    byName.set(d.nombre, arr);
  }
  const lines: string[] = [];
  for (const [nombre, rows] of byName) {
    if (rows.length === 1) {
      const r = rows[0];
      lines.push(`- ${nombre}: ${r.estado}${r.tiene_archivo ? " (con archivo)" : ""}`);
    } else {
      const estados = rows.map((r) => `${r.estado}${r.tiene_archivo ? "+archivo" : ""}`).join(", ");
      lines.push(`- ${nombre}: [${estados}] ← DUPLICADO (${rows.length} filas)`);
    }
  }
  return lines.join("\n");
}

export function buildUserPrompt(regla: string, detalle: string, ctx: ContextoEmbarque | null): string {
  if (!ctx) return "";
  return [
    `**Hallazgo**`,
    `Regla: ${regla}`,
    `Detalle: ${detalle}`,
    ``,
    `**Contexto real del embarque**`,
    `Expediente: ${ctx.expediente} | Estado: ${ctx.estado} | Modo: ${ctx.modo}`,
    `Cliente: ${ctx.cliente}`,
    `ETD: ${ctx.etd ?? "—"} | ETA: ${ctx.eta ?? "—"} | Llegada real: ${ctx.fecha_llegada_real ?? "—"}`,
    `Conceptos venta: ${ctx.conceptos_venta_total} (pendientes: ${ctx.conceptos_venta_pendientes}, facturados: ${ctx.conceptos_venta_facturados})`,
    `Conceptos costo: ${ctx.conceptos_costo_total}`,
    `Facturas (${ctx.facturas.length}): ${ctx.facturas.map((f) => `${f.folio} [${f.estado}] ${f.total} ${f.moneda}`).join("; ") || "—"}`,
    `Proformas (${ctx.proformas.length}): ${ctx.proformas.map((p) => `${p.folio} [${p.estado}]`).join("; ") || "—"}`,
    ``,
    `**Documentos (${ctx.documentos.length} filas vivas)**`,
    formatDocumentos(ctx.documentos),
  ].join("\n");
}

/**
 * Mapea el status code del gateway IA a un par {status, message} legible.
 * Mantiene la lógica fuera del closure de Deno.serve para poder testearla.
 */
export function mapGatewayStatus(status: number): { status: number; message: string } {
  if (status === 429) {
    return { status: 429, message: "Límite de solicitudes excedido, intenta en unos momentos." };
  }
  if (status === 402) {
    return { status: 402, message: "Créditos insuficientes para procesamiento AI." };
  }
  return { status: 500, message: "Error al generar la explicación" };
}
