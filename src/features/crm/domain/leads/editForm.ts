/**
 * Fuente canónica del formulario de edición de un lead.
 *
 * `toLeadEditForm` es la ÚNICA traducción fila de BD → formulario, para que el
 * encabezado (mailto/tel) y los inputs muestren siempre el mismo dato. El patch
 * de guardado sólo incluye los campos que el usuario tocó: editar Notas nunca
 * puede borrar el correo capturado en el alta rápida.
 */
import { EMPTY_LEAD_EDIT_FORM, type LeadEditForm } from "@/types/crm/leadEditForm";

export interface LeadEditSource {
  empresa: string;
  contacto: string | null;
  email: string | null;
  telefono: string | null;
  ciudad: string | null;
  pais: string | null;
  fuente: LeadEditForm["fuente"];
  estado: LeadEditForm["estado"];
  score: number | null;
  interes_modo: string | null;
  notas: string | null;
}

export function toLeadEditForm(lead: LeadEditSource | null | undefined): LeadEditForm {
  if (!lead) return { ...EMPTY_LEAD_EDIT_FORM };
  return {
    empresa: lead.empresa ?? "",
    contacto: lead.contacto ?? "",
    email: lead.email ?? "",
    telefono: lead.telefono ?? "",
    ciudad: lead.ciudad ?? "",
    pais: lead.pais ?? "",
    fuente: lead.fuente,
    estado: lead.estado,
    score: lead.score ?? 3,
    interes_modo: lead.interes_modo ?? "",
    notas: lead.notas ?? "",
  };
}

/** Sólo los campos tocados que realmente difieren del valor persistido. */
export function patchLeadEdit(
  base: LeadEditForm,
  tocados: Partial<LeadEditForm>,
): Partial<LeadEditForm> {
  const patch: Partial<LeadEditForm> = {};
  for (const key of Object.keys(tocados) as (keyof LeadEditForm)[]) {
    const valor = tocados[key];
    if (valor !== undefined && valor !== base[key]) {
      // SAFE-CAST: la llave y el valor provienen del mismo `LeadEditForm`.
      (patch as Record<string, unknown>)[key] = valor;
    }
  }
  return patch;
}
