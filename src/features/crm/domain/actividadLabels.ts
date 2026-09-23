import type { CrmActividadTipo, CrmEntidadTipo } from "@/features/crm/services/actividades";

export const ACTIVIDAD_TIPO_LABEL: Record<CrmActividadTipo, string> = {
  llamada: "Llamada",
  email: "Correo",
  reunion: "Reunión",
  tarea: "Tarea",
  nota: "Nota",
};

export const ACTIVIDAD_ENTIDAD_LABEL: Record<CrmEntidadTipo, string> = {
  lead: "Lead",
  oportunidad: "Oportunidad",
};

export function actividadTipoVariant(tipo: CrmActividadTipo) {
  if (tipo === "llamada" || tipo === "reunion") return "info" as const;
  if (tipo === "tarea") return "warning" as const;
  return "neutral" as const;
}