/**
 * Constantes de UI para la tabla de hallazgos de auditoría.
 */
import type { ReglaAuditoria, SeveridadAuditoria } from "@/types/auditoria";

export const reglaLabel: Record<ReglaAuditoria, string> = {
  docs_faltantes: "Docs faltantes",
  docs_pendientes_avanzado: "Docs pendientes (avanzado)",
  fechas: "Fechas inconsistentes",
  ventas_sin_facturar: "Ventas sin facturar",
};

export const reglaToTab: Record<ReglaAuditoria, string> = {
  docs_faltantes: "documentos",
  docs_pendientes_avanzado: "documentos",
  fechas: "tracking",
  ventas_sin_facturar: "facturacion",
};

export const severidadConfig: Record<
  SeveridadAuditoria,
  { label: string; className: string }
> = {
  critico: {
    label: "Crítico",
    className: "bg-destructive/15 text-destructive border-destructive/30",
  },
  alto: {
    label: "Alto",
    className: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  },
  medio: {
    label: "Medio",
    className: "bg-primary/15 text-primary border-primary/30",
  },
};

export const PAGE_SIZE_OPTIONS = [25, 50, 100] as const;

export function formatEta(eta: string | null): string {
  if (!eta) return "—";
  const [y, m, d] = eta.split("-");
  return `${d}/${m}/${y}`;
}
