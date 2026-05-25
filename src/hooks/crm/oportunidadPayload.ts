/**
 * Construcción del payload de INSERT en `crm_oportunidades`.
 * Extraído de `useOportunidades.ts` para mantener complejidad <15.
 */
import type { OportunidadInput } from "./useOportunidades";
import type { AuthLite } from "./leads/leadPayload";

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
export function buildOportunidadInsertPayload(
  input: OportunidadInput,
  user: AuthLite | null,
) {
  const defaults = {
    cliente_nombre: "",
    monto_estimado: 0,
    moneda: "MXN" as const,
    probabilidad: 0,
    modo: "",
    tipo_carga: "",
    origen: "",
    destino: "",
    notas: "",
    vendedor_email: user?.email ?? "",
  };
  const hasExplicitVendedor = input.vendedor_id !== undefined;
  return {
    ...defaults,
    ...stripUndefined(input),
    vendedor_id: hasExplicitVendedor ? input.vendedor_id : (user?.id ?? null),
    created_by: user?.id ?? null,
  };
}
