/**
 * Hook controller del formulario de Perfil ICP del lead (Etapa 1 CRM Hunter).
 *
 * Espeja `useLeadEditForm`: el formulario se DERIVA de la fila persistida más
 * los campos que el usuario tocó, y sólo se descarta el borrador al cambiar de
 * lead (identidad), no cuando un refetch trae una nueva referencia del mismo
 * lead (p. ej. al guardar el correo en "Datos del lead").
 */
import { useEffect, useMemo, useState } from "react";
import {
  isLeadIcpDirty,
  toLeadIcpForm,
  type LeadIcpForm,
  type LeadIcpSource,
} from "@/features/crm/domain/leads/icp";

export function useLeadIcpForm(
  lead: (LeadIcpSource & { id?: string }) | null | undefined,
  leadId?: string,
) {
  const [tocados, setTocados] = useState<Partial<LeadIcpForm>>({});
  const identidad = leadId ?? lead?.id;

  useEffect(() => {
    setTocados({});
  }, [identidad]);

  const base = useMemo(() => toLeadIcpForm(lead), [lead]);
  const form = useMemo<LeadIcpForm>(() => ({ ...base, ...tocados }), [base, tocados]);

  const set = <K extends keyof LeadIcpForm>(k: K, v: LeadIcpForm[K]) =>
    setTocados((t) => ({ ...t, [k]: v }));

  // Tras guardar, la fila refrescada iguala lo tocado ⇒ dirty vuelve a false
  // sin necesidad de resetear el borrador manualmente.
  const dirty = useMemo(() => (lead ? isLeadIcpDirty(lead, form) : false), [lead, form]);

  return { form, set, dirty, reset: () => setTocados({}) };
}
