/**
 * Agrupación y ranking de tarifas de costeo por ruta + tipo de contenedor.
 * Extraído de `TarifasGroupedView.tsx` (auditoría 2026-07-29, O2 / S1-05).
 *
 * HEURÍSTICO DE ELEGIBILIDAD (documentado, es la única fuente de este
 * criterio en el repo — verificado 2026-07-29):
 *   una tarifa es elegible para "mejor/promedio/Δ máx" si
 *     · (estado_aprobacion ?? "vigente") === "vigente"  (aprobadas; las de
 *       antes del módulo de aprobación no tienen la columna poblada),
 *     · vigente_hasta >= hoy (ISO local), y
 *     · estado !== "reemplazada".
 *   "Mejor" = la elegible con menor `total_comparable` (flete_base +
 *   recargos marcados `incluido_en_total`, ver `services/tarifas/queries.ts`).
 * Si en el futuro el comparador de cotización adopta esta regla, promover
 * este archivo a `domain/` y consumirlo desde ambos lados.
 */
import { vigenciaHint } from "../routes/CosteoTarifas.helpers";

/** Forma mínima que necesita la agrupación (estructural: no acopla a TarifaRow). */
export interface FilaAgrupable {
  puerto_origen_nombre: string;
  puerto_destino_nombre: string;
  tipo_contenedor_nombre: string;
  agente_nombre?: string;
  total_comparable: number;
  vigente_hasta: string;
  estado?: string;
  estado_aprobacion?: string;
}

export interface GrupoTarifas<T extends FilaAgrupable> {
  key: string;
  rutaLabel: string;
  contenedor: string;
  rows: T[];
  mejor: T | null;
  agentes: number;
  porVencer: number;
  promedio: number | null;
  deltaMax: number | null;
  elegiblesCount: number;
}

export function esTarifaElegible(r: Pick<FilaAgrupable, "estado_aprobacion" | "vigente_hasta" | "estado">, today: string): boolean {
  return (r.estado_aprobacion ?? "vigente") === "vigente"
    && r.vigente_hasta >= today
    && r.estado !== "reemplazada";
}

export function buildGruposTarifas<T extends FilaAgrupable>(tarifas: T[], today: string): GrupoTarifas<T>[] {
  const map = new Map<string, GrupoTarifas<T>>();
  for (const t of tarifas) {
    const key = `${t.puerto_origen_nombre}→${t.puerto_destino_nombre}|${t.tipo_contenedor_nombre}`;
    let g = map.get(key);
    if (!g) {
      g = {
        key,
        rutaLabel: `${t.puerto_origen_nombre} → ${t.puerto_destino_nombre}`,
        contenedor: t.tipo_contenedor_nombre,
        rows: [], mejor: null, agentes: 0, porVencer: 0,
        promedio: null, deltaMax: null, elegiblesCount: 0,
      };
      map.set(key, g);
    }
    g.rows.push(t);
  }
  for (const g of map.values()) {
    g.rows.sort((a, b) => a.total_comparable - b.total_comparable);
    const elegibles = g.rows.filter((r) => esTarifaElegible(r, today));
    g.mejor = elegibles[0] ?? null;
    g.agentes = new Set(g.rows.map((r) => r.agente_nombre)).size;
    g.porVencer = elegibles.filter((r) => vigenciaHint(r.vigente_hasta).tone === "warn").length;
    g.elegiblesCount = elegibles.length;
    if (elegibles.length >= 2) {
      const suma = elegibles.reduce((acc, r) => acc + r.total_comparable, 0);
      g.promedio = suma / elegibles.length;
      const peor = elegibles[elegibles.length - 1].total_comparable;
      g.deltaMax = peor - elegibles[0].total_comparable;
    }
  }
  return Array.from(map.values()).sort((a, b) => a.rutaLabel.localeCompare(b.rutaLabel));
}
