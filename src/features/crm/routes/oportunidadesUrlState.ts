/**
 * Estado de la vista de Oportunidades sincronizado en la URL (mismo patrón que
 * Leads/Actividades): búsqueda, filtros (y por tanto la vista guardada activa)
 * y pestaña Kanban/Tabla. Así "Volver a Oportunidades" desde un detalle
 * recupera el contexto del KAM y el enlace es compartible.
 *
 * Los enlaces antiguos sin parámetros siguen funcionando: cada clave ausente
 * cae en su valor por omisión.
 */
import {
  FILTROS_DEFAULT,
  type OportunidadesFiltros,
} from "@/features/crm/domain/oportunidades/filtros";

export type OportunidadesVista = "kanban" | "tabla";

export interface OportunidadesUrlState {
  search: string;
  filtros: OportunidadesFiltros;
  vista: OportunidadesVista;
}

/** Claves propias de esta vista; el resto de la query (p. ej. `clienteId`) se conserva. */
const K = {
  q: "q",
  etapa: "etapa",
  vendedor: "vendedor",
  desde: "desde",
  hasta: "hasta",
  montoMin: "montoMin",
  vista: "vista",
} as const;

export const URL_STATE_DEFAULT: OportunidadesUrlState = {
  search: "",
  filtros: FILTROS_DEFAULT,
  vista: "kanban",
};

export function parseOportunidadesUrl(params: URLSearchParams): OportunidadesUrlState {
  const vistaParam = params.get(K.vista);
  return {
    search: params.get(K.q) ?? "",
    filtros: {
      etapaId: params.get(K.etapa) || FILTROS_DEFAULT.etapaId,
      vendedorId: params.get(K.vendedor) || FILTROS_DEFAULT.vendedorId,
      cierreDesde: params.get(K.desde) ?? "",
      cierreHasta: params.get(K.hasta) ?? "",
      montoMin: params.get(K.montoMin) ?? "",
    },
    vista: vistaParam === "tabla" ? "tabla" : "kanban",
  };
}

/**
 * Devuelve una nueva query preservando parámetros ajenos y omitiendo los
 * valores por omisión (URLs limpias).
 */
export function serializeOportunidadesUrl(
  state: OportunidadesUrlState,
  base: URLSearchParams = new URLSearchParams(),
): URLSearchParams {
  const next = new URLSearchParams(base);
  const set = (key: string, value: string, omitir: string) => {
    if (value && value !== omitir) next.set(key, value);
    else next.delete(key);
  };
  set(K.q, state.search.trim(), "");
  set(K.etapa, state.filtros.etapaId, FILTROS_DEFAULT.etapaId);
  set(K.vendedor, state.filtros.vendedorId, FILTROS_DEFAULT.vendedorId);
  set(K.desde, state.filtros.cierreDesde, "");
  set(K.hasta, state.filtros.cierreHasta, "");
  set(K.montoMin, state.filtros.montoMin, "");
  set(K.vista, state.vista, "kanban");
  return next;
}
