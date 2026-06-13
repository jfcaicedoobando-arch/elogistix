/**
 * Construcción del payload de INSERT en `crm_oportunidades`.
 * Módulo puro reutilizable por services/. No depende de hooks ni de Supabase.
 */
import type { OportunidadInput } from "@/features/crm/services/oportunidades";
import type { AuthLite } from "@/features/crm/domain/leads/leadPayload";

function stripUndefined<T extends object>(obj: T): Partial<T> {
  const out: Partial<T> = {};
  for (const key in obj) {
    if (obj[key] !== undefined) out[key] = obj[key];
  }
  return out;
}

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
    nombre: input.nombre,
    etapa_id: input.etapa_id,
    vendedor_id: hasExplicitVendedor ? input.vendedor_id : (user?.id ?? null),
    created_by: user?.id ?? null,
  };
}
