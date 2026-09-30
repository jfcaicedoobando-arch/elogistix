import { resolverEstadoVigenciaTarifa, type EstadoCanonicoTarifa, type TarifaVigenciaLike } from "@/features/costeo";

export const FILTROS_TARIFAS_AGENTE = [
  { value: "todas", label: "Todas" },
  { value: "borrador", label: "Borrador" },
  { value: "vigente", label: "Vigente" },
  { value: "programada", label: "Programada" },
  { value: "rechazada", label: "Rechazada" },
  { value: "vencida", label: "Vencida" },
  { value: "reemplazada", label: "Reemplazada" },
] as const;

export type FiltroTarifasAgente = typeof FILTROS_TARIFAS_AGENTE[number]["value"];

const FILTRO_POR_ESTADO: Record<EstadoCanonicoTarifa, FiltroTarifasAgente> = {
  Pendiente: "borrador", Vigente: "vigente", Rechazada: "rechazada",
  Vencida: "vencida", Reemplazada: "reemplazada",
};

/** Una sola clasificación para el conteo y las filas, igual al badge de vigencia. */
export function filtroDeTarifaAgente(t: TarifaVigenciaLike, hoy: string): FiltroTarifasAgente {
  const estado = resolverEstadoVigenciaTarifa({
    estadoAprobacion: t.estado_aprobacion, estado: t.estado,
    vigenteDesde: t.vigente_desde ?? undefined, vigenteHasta: t.vigente_hasta, hoy,
  });
  return estado.programada ? "programada" : FILTRO_POR_ESTADO[estado.estadoCanonico];
}
