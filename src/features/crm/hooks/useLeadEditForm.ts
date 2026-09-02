/**
 * Hook controller para el formulario de edición de un Lead CRM.
 * Extraído de `pages/crm/LeadDetalle.tsx` (Power of 10: componente ≤200 LOC).
 *
 * v13.823.31 — El formulario se DERIVA de la fila persistida (fuente canónica
 * `toLeadEditForm`) más los campos que el usuario tocó. Así el input "Correo"
 * nunca aparece vacío cuando la BD sí tiene correo, y guardar sólo envía los
 * campos editados (editar Notas no puede borrar el correo).
 */
import { useEffect, useMemo, useState } from "react";
import { isLeadDirty } from "@/features/crm/domain/leadEditDirty";
import { toLeadEditForm, patchLeadEdit, type LeadEditSource } from "@/features/crm/domain/leads/editForm";
import { type LeadEditForm } from "@/types/crm/leadEditForm";

export type { LeadEditForm };

export function useLeadEditForm(lead: (LeadEditSource & { id?: string }) | undefined | null) {
  const [tocados, setTocados] = useState<Partial<LeadEditForm>>({});
  const leadId = lead?.id;

  // Cambiar de lead (otra ficha) descarta la edición en curso; un refetch del
  // mismo lead conserva lo que el usuario está escribiendo.
  useEffect(() => {
    setTocados({});
  }, [leadId]);

  const base = useMemo(() => toLeadEditForm(lead), [lead]);
  const form = useMemo<LeadEditForm>(() => ({ ...base, ...tocados }), [base, tocados]);

  const set = <K extends keyof LeadEditForm>(k: K, v: LeadEditForm[K]) =>
    setTocados((t) => ({ ...t, [k]: v }));

  const patch = useMemo(() => patchLeadEdit(base, tocados), [base, tocados]);

  const dirty = useMemo(() => {
    if (!lead) return false;
    return isLeadDirty(lead, form);
  }, [lead, form]);

  return { form, set, dirty, patch, reset: () => setTocados({}) };
}
