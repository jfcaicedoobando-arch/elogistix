/**
 * Hook controller del formulario de Perfil ICP del lead (Etapa 1 CRM Hunter).
 */
import { useEffect, useMemo, useState } from "react";
import {
  EMPTY_LEAD_ICP_FORM,
  isLeadIcpDirty,
  toLeadIcpForm,
  type LeadIcpForm,
  type LeadIcpSource,
} from "@/features/crm/domain/leads/icp";

export function useLeadIcpForm(lead: LeadIcpSource | null | undefined) {
  const [form, setForm] = useState<LeadIcpForm>(EMPTY_LEAD_ICP_FORM);

  useEffect(() => {
    if (!lead) return;
    setForm(toLeadIcpForm(lead));
  }, [lead]);

  const set = <K extends keyof LeadIcpForm>(k: K, v: LeadIcpForm[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const dirty = useMemo(() => (lead ? isLeadIcpDirty(lead, form) : false), [lead, form]);

  return { form, set, dirty };
}
