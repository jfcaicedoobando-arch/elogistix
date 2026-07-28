/**
 * Helpers para construir estado inicial del formulario de Oportunidad.
 * Extraído de `useOportunidadForm.ts` para bajar complejidad de la arrow del useEffect.
 */
import type { CrmOportunidadRow, Moneda } from "@/features/crm/types/oportunidades";
import type { User } from "@supabase/supabase-js";
import { EMPTY_OPORTUNIDAD, type OportunidadFormState } from "@/features/crm/domain/oportunidadFormState";

interface Etapa {
  id: string;
  probabilidad_default: number;
}

export function buildFromOportunidad(o: CrmOportunidadRow): OportunidadFormState {
  return {
    nombre: o.nombre,
    cliente_id: o.cliente_id ?? null,
    cliente_nombre: o.cliente_nombre ?? "",
    etapa_id: o.etapa_id,
    monto_estimado: Number(o.monto_estimado ?? 0),
    moneda: (o.moneda as Moneda) ?? "MXN",
    probabilidad: o.probabilidad ?? 0,
    valor_real: Number(o.valor_real ?? 0),
    fecha_cierre_real: o.fecha_cierre_real ?? "",
    fecha_estimada_cierre: o.fecha_estimada_cierre ?? "",
    modo: o.modo ?? "",
    origen: o.origen ?? "",
    destino: o.destino ?? "",
    notas: o.notas ?? "",
    vendedor_id: o.vendedor_id ?? null,
    vendedor_email: o.vendedor_email ?? "",
  };
}

export function buildEmptyForNueva(
  etapas: Etapa[],
  user: User | null,
): OportunidadFormState {
  const primera = etapas[0];
  return {
    ...EMPTY_OPORTUNIDAD,
    etapa_id: primera?.id ?? "",
    probabilidad: primera?.probabilidad_default ?? 0,
    vendedor_id: user?.id ?? null,
    vendedor_email: user?.email ?? "",
  };
}
