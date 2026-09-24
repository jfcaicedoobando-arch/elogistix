/**
 * Helper compartido para aplicar una tarifa marítima al formulario de cotización.
 * Extraído de `TarifaVinculadaPanel` para que el modal `BuscarTarifaDialog` y
 * el bloque inline `SugerenciasTarifaInline` usen exactamente la misma lógica
 * de seteo + reset de overrides + trigger de validación.
 *
 * v13.31.0 — Pack C
 */
import type { UseFormSetValue, UseFormTrigger } from "react-hook-form";
import type { CotizacionFormValues } from "@/features/cotizacion/types";
import type { TopTarifaRow } from "@/features/costeo/types";
import type { FilaCostoLocal } from "@/features/cotizacion/types";
import { fetchRecargosDeTarifa } from "@/features/costeo/services/topTarifas";
import { buildCostosDesdeTarifa } from "./buildCostosDesdeTarifa";
import { etiquetaPuertoCompleta, origenDe, destinoDe } from "@/features/costeo";
import { notifyError } from "@/lib/ui/appFeedback";

/**
 * P1-2: última tarifa solicitada por formulario (clave = `setValue`, estable
 * por instancia de RHF). Una respuesta tardía de otra tarifa se descarta.
 */
const solicitudVigente = new WeakMap<object, string | null>();

/** Invalida cualquier auto-carga en vuelo (p. ej. al quitar la tarifa). */
export function cancelarAutocargaTarifa(setValue: object): void {
  solicitudVigente.set(setValue, null);
}

const OPTS = { shouldValidate: true, shouldDirty: true } as const;

export interface AplicarTarifaOptions {
  /**
   * Si se provee, se descargan los recargos y se construyen filas de costo
   * para auto-cargar la sección Costos & P&L con markup aplicado.
   */
  onAutocargaCostos?: (filas: FilaCostoLocal[]) => void;
  /** Markup decimal (0.15 = 15%) aplicado al precio de venta sugerido. */
  markup?: number;
  /** Cantidad por defecto (normalmente nº de contenedores). */
  cantidad?: number;
}

export function aplicarTarifaAlForm(
  setValue: UseFormSetValue<CotizacionFormValues>,
  trigger: UseFormTrigger<CotizacionFormValues>,
  row: TopTarifaRow,
  options: AplicarTarifaOptions = {},
  /** Validez actual del form para recortar si excede la vigencia de la tarifa. */
  validezActual?: Date | null | undefined,
): void {
  aplicarCamposBase(setValue, row);
  aplicarValidezPropuesta(setValue, row, validezActual);
  void trigger([
    "tiempoTransitoDias",
    "diasLibresDestino",
    "cartaGarantia",
    "tipoContenedor",
    "frecuencia",
    "diasAlmacenaje",
    "validezPropuesta",
    "rutaTexto",
  ]);
  autoCargarCostos(setValue, row, options);
}

function aplicarCamposBase(setValue: UseFormSetValue<CotizacionFormValues>, row: TopTarifaRow): void {
  setValue("tarifaId", row.id, OPTS);
  setValue("tarifaOverride", {}, OPTS);
  // Etapa 3: la ruta de la tarifa es la identidad EXACTA de los puertos. Antes
  // sólo viajaba el texto y al convertir a embarque se volvía a inferir por
  // nombre (dos puertos homónimos podían intercambiarse).
  setValue("puertoOrigenId", row.puerto_origen_id ?? null, OPTS);
  setValue("puertoDestinoId", row.puerto_destino_id ?? null, OPTS);
  // P1-1: el texto visible sale de la MISMA tarifa (sin heurística por nombre)
  // para que texto, IDs y tarifa nunca se contradigan.
  if (row.puerto_origen_nombre) setValue("origen", etiquetaPuertoCompleta(origenDe(row)), OPTS);
  if (row.puerto_destino_nombre) setValue("destino", etiquetaPuertoCompleta(destinoDe(row)), OPTS);

  setValue("tiempoTransitoDias", row.transit_time_dias ?? undefined, OPTS);
  setValue("diasLibresDestino", row.dias_libres_demoras ?? 0, OPTS);
  setValue("cartaGarantia", !!row.naviera_carta_garantia_activa, OPTS);
  // v13.303.35 — Herencia de agente y naviera desde la tarifa (fuente de verdad).
  setValue("agenteId", row.agente_id ?? null, OPTS);
  setValue("agenteNombre", row.agente_nombre ?? "", OPTS);
  setValue("navieraId", row.naviera_id ?? null, OPTS);
  setValue("navieraNombre", row.naviera_nombre ?? "", OPTS);
  if (row.tipo_contenedor_id) {
    setValue("tipoContenedor", row.tipo_contenedor_id, OPTS);
  }
  if (row.puerto_origen_nombre && row.puerto_destino_nombre) {
    setValue("rutaTexto", `${row.puerto_origen_nombre} → ${row.puerto_destino_nombre}`, OPTS);
  }
  if (row.frecuencia_resuelta) {
    setValue("frecuencia", row.frecuencia_resuelta, OPTS);
  }
  if (row.dias_libres_almacenaje_lcl != null) {
    setValue("diasAlmacenaje", row.dias_libres_almacenaje_lcl, OPTS);
  }
}

function aplicarValidezPropuesta(
  setValue: UseFormSetValue<CotizacionFormValues>,
  row: TopTarifaRow,
  validezActual: Date | null | undefined,
): void {
  if (!row.vigente_hasta || !validezActual) return;
  const [y, m, d] = row.vigente_hasta.split("-").map(Number);
  if (!y || !m || !d) return;
  const tarifaHasta = new Date(y, m - 1, d, 23, 59, 59, 999);
  if (validezActual > tarifaHasta) {
    setValue("validezPropuesta", tarifaHasta, OPTS);
  }
}

function autoCargarCostos(
  setValue: object,
  row: TopTarifaRow,
  options: AplicarTarifaOptions,
): void {
  if (!options.onAutocargaCostos) return;
  const cb = options.onAutocargaCostos;
  const markup = options.markup ?? 0.15;
  const rawCantidad = options.cantidad ?? 1;
  const cantidad = Number.isFinite(rawCantidad) && rawCantidad >= 1 ? rawCantidad : 1;
  solicitudVigente.set(setValue, row.id);
  const sigueVigente = () => solicitudVigente.get(setValue) === row.id;
  void fetchRecargosDeTarifa(row.id)
    .then((recargos) => {
      if (!sigueVigente()) return;
      const filas = buildCostosDesdeTarifa({ tarifa: row, recargos, markup, cantidad });
      if (filas.length > 0) cb(filas);
    })
    .catch((error: unknown) => {
      if (!sigueVigente()) return;
      // P1-3: ya no es silencioso. Los costos previos quedan marcados como
      // de otra tarifa (useCostosAutoSync) y el Paso 2 ofrece recalcular.
      notifyError(undefined, {
        title: "No se pudieron cargar los costos de la tarifa",
        description: "Vuelve a elegir la tarifa o recalcula en el Paso 2. Tus costos capturados a mano se conservan.",
        error,
        method: "COTIZACION_AUTOCARGA_COSTOS_TARIFA",
      });
    });
}
