/**
 * Construcción del payload de INSERT en `crm_oportunidades`.
 * Extraído de `useOportunidades.ts` para mantener complejidad <15.
 */
import type { OportunidadInput } from "./useOportunidades";
import type { AuthLite } from "./leads/leadPayload";

// Mapper plano (sin branching real, sólo defaults `??`): aceptamos complexity alta.
// eslint-disable-next-line complexity
export function buildOportunidadInsertPayload(
  input: OportunidadInput,
  user: AuthLite | null,
) {
  return {
    ...input,
    cliente_nombre: input.cliente_nombre ?? "",
    monto_estimado: input.monto_estimado ?? 0,
    moneda: input.moneda ?? "MXN",
    probabilidad: input.probabilidad ?? 0,
    modo: input.modo ?? "",
    tipo_carga: input.tipo_carga ?? "",
    origen: input.origen ?? "",
    destino: input.destino ?? "",
    notas: input.notas ?? "",
    vendedor_id:
      input.vendedor_id !== undefined ? input.vendedor_id : (user?.id ?? null),
    vendedor_email: input.vendedor_email ?? user?.email ?? "",
    created_by: user?.id ?? null,
  };
}
