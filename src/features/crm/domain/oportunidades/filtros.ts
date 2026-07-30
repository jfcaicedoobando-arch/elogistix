/**
 * Tipos y defaults compartidos de los filtros de Oportunidades.
 * Viven en `domain/` para que la capa de dominio (vistas guardadas) pueda
 * consumirlos sin importar desde `components/`.
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
