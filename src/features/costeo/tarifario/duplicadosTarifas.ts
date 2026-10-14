/**
 * Detecta, antes de cargar en borrador, tarifas que ya existen (vigentes,
 * programadas o en borrador con vigencia que se cruza) o que vienen repetidas
 * en el mismo lote. Lógica pura: la pantalla decide cuáles conservar.
 */
import type { TarifaImport } from "./importarTarifas";

export interface TarifaExistente {
  id: string; agente_id: string; naviera_id: string; ruta_id: string; tipo_contenedor_id: string;
  flete_base: number; vigente_desde: string; vigente_hasta: string;
  estado?: string | null; estado_aprobacion?: string | null;
}
type Ruta = { id: string; puerto_origen_id: string; puerto_destino_id: string };

export interface Conflicto {
  /** Índice dentro del lote. */
  indice: number;
  tipo: "existente" | "repetida";
  /** Flete de la tarifa existente o del primer renglón repetido. */
  fleteOtro: number;
  vigenciaOtro: string;
  estadoOtro: string;
}

function rutaDe(t: TarifaImport, rutas: readonly Ruta[]): string {
  if (t.input.ruta_id) return t.input.ruta_id;
  return rutas.find((r) => r.puerto_origen_id === t.origenId && r.puerto_destino_id === t.destinoId)?.id
    ?? `nueva:${t.origenId}>${t.destinoId}`;
}

const clave = (agente: string, naviera: string, ruta: string, tipo: string) => `${agente}|${naviera}|${ruta}|${tipo}`;
const seCruzan = (a1: string, a2: string, b1: string, b2: string) => a1 <= b2 && b1 <= a2;

/** Una tarifa existente cuenta si no fue reemplazada/rechazada y no ha vencido. */
function estaActiva(e: TarifaExistente, hoy: string): boolean {
  return e.estado !== "reemplazada" && e.estado_aprobacion !== "rechazada" && e.vigente_hasta >= hoy;
}

export function detectarConflictos(
  lote: readonly TarifaImport[], existentes: readonly TarifaExistente[], rutas: readonly Ruta[], hoy: string,
): Conflicto[] {
  const porClave = new Map<string, TarifaExistente[]>();
  for (const e of existentes) {
    if (!estaActiva(e, hoy)) continue;
    const k = clave(e.agente_id, e.naviera_id, e.ruta_id, e.tipo_contenedor_id);
    porClave.set(k, [...(porClave.get(k) ?? []), e]);
  }
  const vistos = new Map<string, TarifaImport[]>();
  const out: Conflicto[] = [];
  lote.forEach((t, indice) => {
    const i = t.input;
    const k = clave(i.agente_id, i.naviera_id, rutaDe(t, rutas), i.tipo_contenedor_id);
    const previa = (vistos.get(k) ?? []).find((p) => seCruzan(p.input.vigente_desde, p.input.vigente_hasta, i.vigente_desde, i.vigente_hasta));
    const existente = (porClave.get(k) ?? []).find((e) => seCruzan(e.vigente_desde, e.vigente_hasta, i.vigente_desde, i.vigente_hasta));
    if (existente) {
      out.push({ indice, tipo: "existente", fleteOtro: Number(existente.flete_base), vigenciaOtro: `${existente.vigente_desde} → ${existente.vigente_hasta}`, estadoOtro: existente.estado_aprobacion === "borrador" ? "borrador" : "vigente" });
    } else if (previa) {
      out.push({ indice, tipo: "repetida", fleteOtro: previa.input.flete_base, vigenciaOtro: `${previa.input.vigente_desde} → ${previa.input.vigente_hasta}`, estadoOtro: `fila ${previa.fila}` });
    }
    vistos.set(k, [...(vistos.get(k) ?? []), t]);
  });
  return out;
}

/** Por defecto se conservan sólo las tarifas sin conflicto. */
export function seleccionInicial(total: number, conflictos: readonly Conflicto[]): Set<number> {
  const omitir = new Set(conflictos.map((c) => c.indice));
  return new Set(Array.from({ length: total }, (_, i) => i).filter((i) => !omitir.has(i)));
}
