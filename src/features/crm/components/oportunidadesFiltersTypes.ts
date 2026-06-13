/**
 * Tipos y defaults compartidos para los filtros de Oportunidades.
 * Vive aparte de `OportunidadesFiltersBar.tsx` para no romper Fast Refresh.
 */

export interface OportunidadesFiltros {
  etapaId: string;        // "todas" | etapa.id
  vendedorId: string;     // "todos" | vendedor_id
  cierreDesde: string;    // "" | yyyy-mm-dd
  cierreHasta: string;
  montoMin: string;       // "" o número como string
}

export const FILTROS_DEFAULT: OportunidadesFiltros = {
  etapaId: "todas",
  vendedorId: "todos",
  cierreDesde: "",
  cierreHasta: "",
  montoMin: "",
};
