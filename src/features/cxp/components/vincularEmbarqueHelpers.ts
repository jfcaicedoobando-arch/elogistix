/**
 * Helpers puros para `VincularEmbarqueSection` — extraídos en v13.182.0
 * (Wave 2 · Power-of-10 splits). Sin cambios de comportamiento.
 */
import { notifyInfo, notifySuccess } from "@/lib/ui/appFeedback";
import type { ConceptoCostoAbierto } from "@/features/cxp/hooks";
import { sugerirVinculos, type SugerenciaVinculo } from "@/features/compras/matching/matcher";

export interface Grupo {
  expediente: string;
  embarqueId: string;
  items: ConceptoCostoAbierto[];
}

export function agruparPorEmbarque(items: ConceptoCostoAbierto[]): Grupo[] {
  const map = new Map<string, Grupo>();
  for (const it of items) {
    const key = it.embarque_id;
    const g = map.get(key);
    if (g) g.items.push(it);
    else map.set(key, {
      embarqueId: key,
      expediente: it.embarque_expediente ?? key.slice(0, 8),
      items: [it],
    });
  }
  return Array.from(map.values()).sort((a, b) =>
    a.expediente.localeCompare(b.expediente, "es", { numeric: true, sensitivity: "base" }),
  );
}

export interface FiltrarGruposArgs {
  texto: string;
  soloMarcados: boolean;
  seleccion: Record<string, unknown>;
}

/**
 * Filtra `grupos` por texto (concepto, expediente o monto como string) y/o
 * conservando sólo los items marcados. Grupos que se quedan sin items se omiten.
 * Función pura, sin dependencias externas.
 */
export function filtrarGrupos(grupos: Grupo[], args: FiltrarGruposArgs): Grupo[] {
  const t = args.texto.trim().toLowerCase();
  const out: Grupo[] = [];
  for (const g of grupos) {
    const items = g.items.filter((it) => {
      if (args.soloMarcados && !args.seleccion[it.id]) return false;
      if (!t) return true;
      if (g.expediente.toLowerCase().includes(t)) return true;
      if (it.concepto.toLowerCase().includes(t)) return true;
      if (String(it.monto).includes(t)) return true;
      return false;
    });
    if (items.length > 0) out.push({ ...g, items });
  }
  return out;
}



export function pluralS(n: number, base: string): string {
  return `${n} ${base}${n === 1 ? "" : "s"}`;
}

export function notificarResumen(
  res: { seleccion: SugerenciaVinculo[]; descartadosPorMoneda: number },
  totalCandidatos: number,
) {
  if (res.seleccion.length === 0) {
    notifyInfo(undefined, { title: "Sin sugerencias con confianza suficiente. Marca manualmente los conceptos." });
    return;
  }
  const fuertes = res.seleccion.filter((s) => s.fuerte).length;
  const dudosas = res.seleccion.length - fuertes;
  const sinMatch = totalCandidatos - res.seleccion.length - res.descartadosPorMoneda;
  const partes: string[] = [`${pluralS(res.seleccion.length, "sugerencia")} aplicada${res.seleccion.length === 1 ? "" : "s"}`];
  if (dudosas > 0) partes.push(pluralS(dudosas, "dudosa"));
  if (res.descartadosPorMoneda > 0) partes.push(`${pluralS(res.descartadosPorMoneda, "descartada")} por moneda`);
  if (sinMatch > 0) partes.push(`${sinMatch} sin match`);
  notifySuccess(undefined, { title: partes.join(" · ") });
}

export function calcularPuedeSugerir(args: {
  onAplicar: unknown;
  descripcion?: string;
  monto?: number;
  moneda?: string;
  totalCandidatos: number;
}): boolean {
  const { onAplicar, descripcion, monto, moneda, totalCandidatos } = args;
  return !!onAplicar && !!descripcion && !!moneda && (monto ?? 0) > 0 && totalCandidatos > 0;
}

export function ejecutarSugerencia(args: {
  data: ConceptoCostoAbierto[];
  descripcion: string;
  monto: number;
  moneda: string;
  onAplicar: (sugs: ReadonlyArray<{ conceptoId: string; concepto: string; monto: number; embarque_id: string }>) => void;
  setUltima: (s: SugerenciaVinculo[]) => void;
}) {
  const res = sugerirVinculos(
    { descripcion: args.descripcion, monto: args.monto, moneda: args.moneda },
    args.data.map((c) => ({
      id: c.id, concepto: c.concepto, monto: c.monto, moneda: c.moneda, embarque_id: c.embarque_id,
    })),
  );
  args.setUltima(res.seleccion);
  args.onAplicar(
    res.seleccion.map((s) => ({
      conceptoId: s.conceptoId, concepto: s.concepto, monto: s.monto, embarque_id: s.embarque_id,
    })),
  );
  notificarResumen(res, args.data.length);
}
