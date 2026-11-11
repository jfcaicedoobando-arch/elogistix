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
import { etiquetaPuertoCompleta, origenDe, destinoDe } from "@/features/costeo";

const OPTS = { shouldValidate: true, shouldDirty: true } as const;

export function aplicarTarifaAlForm(
  setValue: UseFormSetValue<CotizacionFormValues>,
  trigger: UseFormTrigger<CotizacionFormValues>,
  row: TopTarifaRow,
  /** Validez actual del form para recortar si excede la vigencia de la tarifa. */
  validezActual?: Date | null,
): void {
  setValue("monedaTarifa", row.moneda === "USD" || row.moneda === "MXN" ? row.moneda : null, OPTS);
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
    "monedaTarifa",
  ]);
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
