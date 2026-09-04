/**
 * Rediseño CRM (v13.766.0) — etapas del embudo comercial.
 *
 * Flujo: Lead → Prospecto → Oportunidad → (alta de cliente fuera del CRM).
 *
 *  - `LEAD_ESTADOS_ETAPA_LEAD`: primer contacto. Es lo único que se ve en /crm/leads.
 *  - `LEAD_ESTADOS_ETAPA_PROSPECTO`: ya pasaron el gate de calificación (ICP)
 *    y viven en /crm/prospectos.
 *  - `Convertido`: ya existe como cliente oficial; sale del embudo.
 */
import { LEAD_ESTADOS_MANUALES, type CrmLeadEstado } from "./constants";
import { CAMPOS_MINIMOS_ICP, toLeadIcpForm, type LeadIcpSource } from "./icp";

/**
 * v13.823.62: deriva de la lista de estados MANUALES (fuente única) en vez de
 * duplicar los tres nombres. La etapa "Lead" es exactamente lo que una persona
 * puede capturar a mano.
 */
export const LEAD_ESTADOS_ETAPA_LEAD: CrmLeadEstado[] = [...LEAD_ESTADOS_MANUALES];


export const LEAD_ESTADOS_ETAPA_PROSPECTO: CrmLeadEstado[] = [
  "Calificado",
  "Prospecto",
  "Pendiente de alta",
];

/** Estados que ya no pueden calificarse (o ya están calificados). */
export function esProspecto(estado: CrmLeadEstado): boolean {
  return LEAD_ESTADOS_ETAPA_PROSPECTO.includes(estado);
}

export function puedeCalificarse(estado: CrmLeadEstado): boolean {
  return estado === "Nuevo" || estado === "Contactado";
}

/**
 * Campos del perfil comercial que la RPC `crm_calificar_prospecto` exige.
 * Mantener alineado con la validación en base de datos.
 */
export const CAMPOS_GATE_PROSPECTO = CAMPOS_MINIMOS_ICP;

export const ETIQUETAS_GATE_PROSPECTO: Record<
  (typeof CAMPOS_GATE_PROSPECTO)[number],
  string
> = {
  sector: "Sector",
  mercancia: "Mercancía",
  rutas: "Rutas",
  volumen: "Volumen",
  frecuencia: "Frecuencia",
  dolor_explicito: "Dolor explícito",
  proveedor_actual: "Proveedor actual",
};

/** Campos del gate que aún están vacíos en el lead (para avisar antes de la RPC). */
export function faltantesGateProspecto(lead: LeadIcpSource | null | undefined): string[] {
  const form = toLeadIcpForm(lead);
  return CAMPOS_GATE_PROSPECTO.filter((key) => form[key].trim() === "").map(
    (key) => ETIQUETAS_GATE_PROSPECTO[key],
  );
}
