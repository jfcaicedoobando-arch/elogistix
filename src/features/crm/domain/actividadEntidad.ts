import type { CrmActividadRow } from "../services/actividades";

export interface ActividadEntidadContexto {
  entidad_nombre?: string | null;
  entidad_estado?: "disponible" | "no_disponible" | "error";
}

export function actividadEntidadNombre(a: ActividadEntidadContexto): string {
  if (a.entidad_estado === "error") return "No pudimos consultar la entidad";
  if (a.entidad_estado === "no_disponible") return "Entidad no disponible";
  return a.entidad_nombre?.trim() || "Sin nombre disponible";
}

/** Sólo enlaza entidades leídas con éxito; no adivina nombres ni rutas legacy. */
export function actividadEntidadHref(a: Pick<CrmActividadRow, "entidad_id" | "entidad_tipo"> & ActividadEntidadContexto): string | null {
  if (a.entidad_estado !== "disponible" || !a.entidad_id) return null;
  const id = encodeURIComponent(a.entidad_id);
  if (a.entidad_tipo === "lead") return `/crm/leads/${id}`;
  if (a.entidad_tipo === "oportunidad") return `/crm/oportunidades/${id}`;
  return null;
}
