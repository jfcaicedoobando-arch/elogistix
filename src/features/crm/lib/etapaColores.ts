/**
 * O3.15c — Paleta cerrada de colores de etapa del pipeline CRM.
 *
 * Antes cada etapa usaba un hex libre (`<input type="color">`) sin garantía
 * de contraste en modo oscuro. Este módulo es la única fuente de colores
 * "por tipo de etapa" (abierta/ganada/perdida) y de fallback cuando la
 * etapa no trae `color` propio — siempre mapeado a tokens semánticos
 * (`--success`, `--destructive`, `--accent`, `--muted-foreground`), que ya
 * están verificados con contraste AA en claro y oscuro (ver `index.css`).
 *
 * El selector de color libre en `EtapasPipelineEditor` se conserva (el
 * usuario puede personalizar por etapa), pero el fallback y las columnas
 * "cerradas" (ganada/perdida) siempre usan esta paleta, no un hex inline.
 */
import { CHART as CHART_TOKENS } from "@/lib/chartTokens";

export type EtapaColorTipo = "abierta" | "ganada" | "perdida";

/** Paleta cerrada por tipo de etapa — token HSL semántico, no hex suelto. */
const ETAPA_COLOR_POR_TIPO: Record<EtapaColorTipo, string> = {
  ganada: CHART_TOKENS.success,
  perdida: CHART_TOKENS.destructive,
  abierta: CHART_TOKENS.accent,
};

/**
 * Color de borde/acento para una etapa: respeta el color propio elegido en
 * `EtapasPipelineEditor` si existe; si no, cae en la paleta cerrada por tipo.
 */
export function colorAcentoEtapa(etapa: { color?: string | null; tipo: string }): string {
  if (etapa.color) return etapa.color;
  return ETAPA_COLOR_POR_TIPO[etapa.tipo as EtapaColorTipo] ?? ETAPA_COLOR_POR_TIPO.abierta;
}
