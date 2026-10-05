import type { EstadoEmpresaCrm } from "@/features/crm/services/estadoEmpresaCrm";

const VARIANTE = { Lead: "outline", Sospechoso: "outline", Prospecto: "default", Cliente: "secondary" } as const;

/** Presentación compartida del estado; no modifica su valor de negocio. */
export function varianteEstadoEmpresa(estado: EstadoEmpresaCrm) {
  return VARIANTE[estado];
}
