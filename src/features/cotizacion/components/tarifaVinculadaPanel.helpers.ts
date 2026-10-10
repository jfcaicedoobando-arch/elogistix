/**
 * Helpers puros del panel `TarifaVinculadaPanel`. Aislados en un archivo
 * propio para cumplir con react-refresh/only-export-components.
 */
import type { TopTarifaRow } from "@/features/costeo/types";
import { claveIdentidadCatalogo } from "@/features/catalogos";

type TipoContenedorItem = { id: string; name: string; code?: string; idsEquivalentes?: string[] };

const normalizarNombreContenedor = (s: string) =>
  s.toLowerCase().replace(/['"'`]/g, "").replace(/\s+/g, " ").trim();

export function resolveTipoContenedorId(
  tipoContenedorActual: string | undefined,
  tiposContenedor: TipoContenedorItem[],
): string | undefined {
  const valor = tipoContenedorActual?.trim();
  if (!valor) return undefined;
  const porId = tiposContenedor.find((t) => t.id === valor || t.idsEquivalentes?.includes(valor));
  if (porId) return porId.id;
  const objetivo = normalizarNombreContenedor(valor);
  const porTexto = tiposContenedor.find((t) => normalizarNombreContenedor(t.name) === objetivo
    || (t.code && normalizarNombreContenedor(t.code) === objetivo));
  if (porTexto) return porTexto.id;
  // Nombres históricos (Dry/Standard, HC/High Cube) usan la identidad de
  // selección existente: GP y Dry siguen siendo tipos distintos.
  const identidad = claveIdentidadCatalogo({ code: valor, name: valor });
  if (identidad.startsWith("raw:")) return undefined;
  return tiposContenedor.find((t) => claveIdentidadCatalogo({ code: t.code ?? "", name: t.name }) === identidad)?.id;
}

function difiereTipoContenedor(
  tipoTarifa: string | undefined,
  tipoActual: string | undefined,
  catalogo?: TipoContenedorItem[],
): boolean {
  if (!tipoTarifa || !tipoActual || tipoTarifa === tipoActual) return false;
  // La selección puede ser UUID, código o nombre. Si el catálogo aún no
  // llegó, no se compara un nombre contra un UUID; después sí se avisa de
  // valores desconocidos, sin ocultar una discrepancia real.
  const actualId = catalogo ? resolveTipoContenedorId(tipoActual, catalogo)
    ?? (catalogo.length ? tipoActual : undefined) : tipoActual;
  const tarifaId = catalogo ? resolveTipoContenedorId(tipoTarifa, catalogo) ?? tipoTarifa : tipoTarifa;
  return !!actualId && actualId !== tarifaId;
}

export interface TarifaWarnings {
  vencidaAntesDeValidez: boolean;
  tipoMismatch: boolean;
}

export function faltaCatalogoParaValidarTipo(
  tarifa: Pick<TopTarifaRow, "tipo_contenedor_id"> | null | undefined,
  tipoActual: string | undefined,
  catalogo: TipoContenedorItem[],
  cargando: boolean,
): boolean {
  return !cargando && catalogo.length === 0 && !!tarifa && !!tipoActual
    && tipoActual !== tarifa.tipo_contenedor_id;
}

export function computeTarifaWarnings(
  tarifa: Pick<TopTarifaRow, "vigente_hasta" | "tipo_contenedor_id"> | null | undefined,
  validez: Date | null | undefined,
  tipoContenedorActual: string | undefined,
  tiposContenedor?: TipoContenedorItem[],
): TarifaWarnings {
  // EC-06: `vigente_hasta` es date-only ("YYYY-MM-DD"); `new Date(str)` lo
  // parsea como medianoche UTC (= día anterior 18:00 en CDMX). Mismo patrón
  // que `aplicarTarifa.ts` (fin de día LOCAL) para no adelantar el aviso.
  let tarifaHasta: Date | null = null;
  if (tarifa?.vigente_hasta) {
    const [y, m, d] = tarifa.vigente_hasta.split("-").map(Number);
    if (y && m && d) tarifaHasta = new Date(y, m - 1, d, 23, 59, 59, 999);
  }
  return {
    vencidaAntesDeValidez: !!tarifaHasta && !!validez && tarifaHasta < validez,
    tipoMismatch: difiereTipoContenedor(tarifa?.tipo_contenedor_id, tipoContenedorActual, tiposContenedor),
  };
}
