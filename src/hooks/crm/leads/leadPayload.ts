/**
 * Construcción de payloads para INSERT en `crm_leads`.
 * Extraído de `mutations.ts` y `bulk.ts` para mantener complejidad <15.
 */
import type { LeadInput } from "./constants";

export interface AuthLite {
  id?: string | null;
  email?: string | null;
}

export function buildLeadInsertPayload(input: LeadInput, user: AuthLite | null) {
  return {
    empresa: input.empresa,
    contacto: input.contacto ?? "",
    email: input.email ?? "",
    telefono: input.telefono ?? "",
    ciudad: input.ciudad ?? "",
    pais: input.pais ?? "",
    fuente: input.fuente ?? "Otro",
    estado: input.estado ?? "Nuevo",
    score: input.score ?? 3,
    interes_modo: input.interes_modo ?? "",
    notas: input.notas ?? "",
    vendedor_id:
      input.vendedor_id !== undefined ? input.vendedor_id : (user?.id ?? null),
    vendedor_email: input.vendedor_email ?? user?.email ?? "",
    created_by: user?.id ?? null,
  };
}
