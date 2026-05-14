/**
 * Helpers puros para exportar hallazgos de auditoría a CSV.
 * Sin dependencias de React. Power of 10 §5/§4: extrae lógica de presentación.
 */
import { exportToCsv } from "@/generators/exportCsv";
import { reglaShortLabel } from "@/lib/ui/auditoriaConfig";
import type { HallazgoAuditoria } from "@/types/auditoria";

const COLUMNS = [
  { key: "severidad", label: "Severidad" },
  { key: "expediente", label: "Expediente" },
  { key: "regla", label: "Regla" },
  { key: "cliente", label: "Cliente" },
  { key: "modo", label: "Modo" },
  { key: "estado", label: "Estado" },
  { key: "eta", label: "ETA" },
  { key: "detalle", label: "Detalle" },
  { key: "documentos_faltantes", label: "Documentos faltantes" },
] as const;

export function exportHallazgosCsv(hallazgos: HallazgoAuditoria[]): void {
  const rows = hallazgos.map((h) => ({
    severidad: h.severidad,
    expediente: h.expediente,
    regla: reglaShortLabel(h.regla),
    cliente: h.cliente_nombre || "",
    modo: h.modo,
    estado: h.estado,
    eta: h.eta || "",
    detalle: h.detalle,
    documentos_faltantes: (h.documentos_faltantes || []).join(" | "),
  }));
  const fecha = new Date().toISOString().slice(0, 10);
  exportToCsv(`auditoria_${fecha}.csv`, [...COLUMNS], rows);
}
