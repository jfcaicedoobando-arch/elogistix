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
  autoCargarCostos(row, options);
}

function aplicarCamposBase(setValue: UseFormSetValue<CotizacionFormValues>, row: TopTarifaRow): void {
  setValue("tarifaId", row.id, OPTS);
  setValue("tarifaOverride", {}, OPTS);
  setValue("tiempoTransitoDias", row.transit_time_dias ?? undefined, OPTS);
  setValue("diasLibresDestino", row.dias_libres_demoras ?? 0, OPTS);
  setValue("cartaGarantia", !!row.naviera_carta_garantia_activa, OPTS);
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

function autoCargarCostos(row: TopTarifaRow, options: AplicarTarifaOptions): void {
  if (!options.onAutocargaCostos) return;
  const cb = options.onAutocargaCostos;
  const markup = options.markup ?? 0.15;
  const rawCantidad = options.cantidad ?? 1;
  const cantidad = Number.isFinite(rawCantidad) && rawCantidad >= 1 ? rawCantidad : 1;
  void fetchRecargosDeTarifa(row.id)
    .then((recargos) => {
      const filas = buildCostosDesdeTarifa({ tarifa: row, recargos, markup, cantidad });
      if (filas.length > 0) cb(filas);
    })
    .catch(() => {
      // Silencioso: el usuario siempre puede capturar manualmente.
    });
}
