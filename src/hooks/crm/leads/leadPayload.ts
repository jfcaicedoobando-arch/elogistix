/**
 * Construcción de payloads para INSERT en `crm_leads`.
 * Extraído de `mutations.ts` y `bulk.ts` para mantener complejidad <15.
 */
import type { LeadInput } from "./constants";

export interface AuthLite {
  id?: string | null;
  email?: string | null;
}

/** Quita las claves cuyo valor es `undefined` para no pisar defaults vía spread. */
function stripUndefined<T extends object>(obj: T): Partial<T> {
  const out: Partial<T> = {};
  for (const key in obj) {
    if (obj[key] !== undefined) out[key] = obj[key];
  }
  return out;
}

/**
 * Defaults aplanados (sin branching): merge de defaults + input limpio.
 * Reemplaza la cadena de `??` que disparaba `complexity > 15`.
 */
export function buildLeadInsertPayload(input: LeadInput, user: AuthLite | null) {
  const defaults = {
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
    vendedor_email: user?.email ?? "",
  };
  const hasExplicitVendedor = input.vendedor_id !== undefined;
  return {
    ...defaults,
    ...stripUndefined(input),
    empresa: input.empresa,
    vendedor_id: hasExplicitVendedor ? input.vendedor_id : (user?.id ?? null),
    created_by: user?.id ?? null,
  };
}
