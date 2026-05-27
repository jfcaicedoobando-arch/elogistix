/**
 * Diff puro entre un lead persistido y su edición en curso.
 * Extraído de `useLeadEditForm.ts` para bajar complejidad.
 */
import type { LeadEditForm } from "@/hooks/crm/useLeadEditForm";

interface LeadLike {
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

/** Compara campo texto (lead nullable vs form string). */
function txtDiff(a: string | null | undefined, b: string): boolean {
  return (a ?? "") !== b;
}

export function isLeadDirty(lead: LeadLike, form: LeadEditForm): boolean {
  if (lead.empresa !== form.empresa) return true;
  if (txtDiff(lead.contacto, form.contacto)) return true;
  if (txtDiff(lead.email, form.email)) return true;
  if (txtDiff(lead.telefono, form.telefono)) return true;
  if (txtDiff(lead.ciudad, form.ciudad)) return true;
  if (txtDiff(lead.pais, form.pais)) return true;
  if (lead.fuente !== form.fuente) return true;
  if (lead.estado !== form.estado) return true;
  if ((lead.score ?? 3) !== form.score) return true;
  if (txtDiff(lead.interes_modo, form.interes_modo)) return true;
  if (txtDiff(lead.notas, form.notas)) return true;
  return false;
}
