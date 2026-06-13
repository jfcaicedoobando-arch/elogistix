/**
 * Hook controller para el formulario de edición de un Lead CRM.
 * Extraído de `pages/crm/LeadDetalle.tsx` (Power of 10: componente ≤200 LOC).
 */
import { useEffect, useMemo, useState } from "react";
import { isLeadDirty } from "@/features/crm/domain/leadEditDirty";
import { type LeadEditForm, EMPTY_LEAD_EDIT_FORM as EMPTY_FORM } from "@/types/crm/leadEditForm";
import type { CrmLeadEstado, CrmLeadFuente } from "@/features/crm/domain/leads/constants";

export type { LeadEditForm };

interface LeadLike {
  empresa: string;
  contacto: string | null;
  email: string | null;
  telefono: string | null;
  ciudad: string | null;
  pais: string | null;
  fuente: CrmLeadFuente;
  estado: CrmLeadEstado;
  score: number | null;
  interes_modo: string | null;
  notas: string | null;
}

export function useLeadEditForm(lead: LeadLike | undefined | null) {
  const [form, setForm] = useState<LeadEditForm>(EMPTY_FORM);

  useEffect(() => {
    if (!lead) return;
    setForm({
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
    });
  }, [lead]);

  const set = <K extends keyof LeadEditForm>(k: K, v: LeadEditForm[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const dirty = useMemo(() => {
    if (!lead) return false;
    return isLeadDirty(lead, form);
  }, [lead, form]);

  return { form, set, dirty };
}
