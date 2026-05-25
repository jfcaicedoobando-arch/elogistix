/**
 * Hook controller para el formulario de edición de un Lead CRM.
 * Extraído de `pages/crm/LeadDetalle.tsx` (Power of 10: componente ≤200 LOC).
 */
import { useEffect, useMemo, useState } from "react";
import type { CrmLeadEstado, CrmLeadFuente } from "@/hooks/crm/useLeads";

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

const EMPTY_FORM: LeadEditForm = {
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
    return (
      lead.empresa !== form.empresa ||
      (lead.contacto ?? "") !== form.contacto ||
      (lead.email ?? "") !== form.email ||
      (lead.telefono ?? "") !== form.telefono ||
      (lead.ciudad ?? "") !== form.ciudad ||
      (lead.pais ?? "") !== form.pais ||
      lead.fuente !== form.fuente ||
      lead.estado !== form.estado ||
      (lead.score ?? 3) !== form.score ||
      (lead.interes_modo ?? "") !== form.interes_modo ||
      (lead.notas ?? "") !== form.notas
    );
  }, [lead, form]);

  return { form, set, dirty };
}
