/**
 * Tipo de formulario de edición de Lead CRM.
 * Vivía en `hooks/crm/useLeadEditForm.ts`; movido a `types/` para que
 * `lib/crm/leadEditDirty.ts` pueda tiparse sin violar la regla lib→hooks.
 */
import type { CrmLeadEstado, CrmLeadFuente } from "@/features/crm/domain/leads/constants";

export interface LeadEditForm {
  empresa: string;
  contacto: string;
  email: string;
  telefono: string;
  ciudad: string;
  pais: string;
  fuente: CrmLeadFuente;
  estado: CrmLeadEstado;
  score: number;
  interes_modo: string;
  notas: string;
}

export const EMPTY_LEAD_EDIT_FORM: LeadEditForm = {
  empresa: "",
  contacto: "",
  email: "",
  telefono: "",
  ciudad: "",
  pais: "",
  fuente: "Otro",
  estado: "Nuevo",
  score: 3,
  interes_modo: "",
  notas: "",
};
