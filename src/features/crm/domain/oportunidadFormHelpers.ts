/**
 * Helpers para construir estado inicial del formulario de Oportunidad.
 * Extraído de `useOportunidadForm.ts` para bajar complejidad de la arrow del useEffect.
 *
 * v13.629.1 — `buildFromOportunidad` se dividió en tres bloques puros
 * (identidad, comercial, metas) para cumplir el límite de complejidad.
 * Fase 2 rediseño CRM — el origen (prospecto/cliente) viaja en el estado.
 */
import type { CrmOportunidadRow, Moneda } from "@/features/crm/types/oportunidades";
import type { User } from "@supabase/supabase-js";
import {
  EMPTY_OPORTUNIDAD,
  type OportunidadFormState,
} from "@/features/crm/domain/oportunidadFormState";

interface Etapa {
  id: string;
  probabilidad_default: number;
  tipo?: string;
}

/** Origen inicial opcional (p. ej. al crear desde la ficha del prospecto). */
export interface OrigenInicial {
  tipo: "prospecto" | "cliente";
  id: string;
  nombre: string;
}

function bloqueIdentidad(o: CrmOportunidadRow) {
  return {
    nombre: o.nombre,
    origen_tipo: (o.lead_id ? "prospecto" : "cliente") as OportunidadFormState["origen_tipo"],
    lead_id: o.lead_id ?? null,
    lead_nombre: "",
    cliente_id: o.cliente_id ?? null,
    cliente_nombre: o.cliente_nombre ?? "",
    etapa_id: o.etapa_id,
    vendedor_id: o.vendedor_id ?? null,
    vendedor_email: o.vendedor_email ?? "",
  };
}

function bloqueComercial(o: CrmOportunidadRow) {
  return {
    monto_estimado: Number(o.monto_estimado ?? 0),
    moneda: (o.moneda as Moneda) ?? "MXN",
    probabilidad: o.probabilidad ?? 0,
    valor_real: Number(o.valor_real ?? 0),
    fecha_cierre_real: o.fecha_cierre_real ?? "",
    fecha_estimada_cierre: o.fecha_estimada_cierre ?? "",
  };
}

function bloqueRuta(o: CrmOportunidadRow) {
  return {
    modo: o.modo ?? "",
    origen: o.origen ?? "",
    destino: o.destino ?? "",
    notas: o.notas ?? "",
  };
}

function bloqueMetas(o: CrmOportunidadRow) {
  return {
    monto_meta: Number(o.monto_meta ?? 0),
    fecha_meta_cierre: o.fecha_meta_cierre ?? "",
    compromiso_nota: o.compromiso_nota ?? "",
    margen_pct: Number(o.margen_pct ?? 0),
    riesgos_objeciones: o.riesgos_objeciones ?? "",
  };
}

export function buildFromOportunidad(o: CrmOportunidadRow): OportunidadFormState {
  return {
    ...bloqueIdentidad(o),
    ...bloqueComercial(o),
    ...bloqueRuta(o),
    ...bloqueMetas(o),
  };
}

function bloqueOrigenInicial(origen: OrigenInicial | null | undefined) {
  if (!origen) return {};
  if (origen.tipo === "prospecto") {
    return {
      origen_tipo: "prospecto" as const,
      lead_id: origen.id,
      lead_nombre: origen.nombre,
      nombre: origen.nombre ? `Oportunidad ${origen.nombre}` : "",
    };
  }
  return {
    origen_tipo: "cliente" as const,
    cliente_id: origen.id,
    cliente_nombre: origen.nombre,
    nombre: origen.nombre ? `Oportunidad ${origen.nombre}` : "",
  };
}

export function buildEmptyForNueva(
  etapas: Etapa[],
  user: User | null,
  origen?: OrigenInicial | null,
): OportunidadFormState {
  // v13.823.51 — una oportunidad nueva nace en la primera etapa ABIERTA (nunca
  // en ganada/perdida, que exigen cierre real o motivo de pérdida).
  const primera = etapas.find((e) => e.tipo === "abierta") ?? etapas[0];
  return {
    ...EMPTY_OPORTUNIDAD,
    etapa_id: primera?.id ?? "",
    probabilidad: primera?.probabilidad_default ?? 0,
    vendedor_id: user?.id ?? null,
    vendedor_email: user?.email ?? "",
    ...bloqueOrigenInicial(origen),
  };
}
