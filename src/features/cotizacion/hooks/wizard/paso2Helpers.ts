/**
 * Helpers puros del Paso 2 del wizard de cotización.
 *
 * Se extraen de `usePaso2Handler` para (a) bajar la complejidad del callback y
 * (b) mantener la mutación del ref de firma fuera del cuerpo del hook. No
 * cambian comportamiento.
 */
import type { MutableRefObject } from "react";
import { buildConceptosFromCostos } from "@/features/cotizacion/services";
import { notifyError } from "@/lib/ui/appFeedback";
import { costosSinConcepto } from "@/features/cotizacion/domain/cotizacionVentaSync";
import { costosPaso2Schema, primerError } from "@/features/cotizacion/domain/schemas/wizardPasos";
import { firmaCostos } from "./wizardStepsTypes";
import type { FilaCostoLocal } from "@/features/cotizacion/types";
import type { ConceptoVentaCotizacion } from "@/features/cotizacion/hooks/useCotizaciones";

/** true = el paso 2 es válido; false = ya se notificó el error al usuario. */
export function validarPaso2(costosInternos: FilaCostoLocal[]): boolean {
  const sinConcepto = costosSinConcepto(costosInternos);
  const errorPaso2 = primerError(costosPaso2Schema, {
    totalCostos: costosInternos.length,
    renglonesSinConcepto: sinConcepto.length,
  });
  if (!errorPaso2) return true;

  notifyError(undefined, {
    title: errorPaso2,
    description: sinConcepto.length > 0
      ? `Selecciona el concepto de ${sinConcepto.length === 1 ? "1 renglón" : `${sinConcepto.length} renglones`} con importes capturados; sin nombre no se genera el concepto de venta.`
      : "El paso 3 usa los costos del paso 2 para generar los conceptos de venta.",
  });
  return false;
}

interface SyncConceptosArgs {
  costosInternos: FilaCostoLocal[];
  tasaIva: number;
  lastCostosHash: MutableRefObject<string | null>;
  costosPreLlenados: boolean;
  setConceptosUSD: (c: ConceptoVentaCotizacion[]) => void;
  setConceptosMXN: (c: ConceptoVentaCotizacion[]) => void;
  setCostosPreLlenados: (v: boolean) => void;
}

/**
 * Re-sincronización idempotente: sólo regenera conceptos si la firma de costos
 * cambió respecto al último snapshot procesado.
 */
export function sincronizarConceptosPaso2(args: SyncConceptosArgs): void {
  const hashActual = firmaCostos(args.costosInternos);
  if (hashActual === args.lastCostosHash.current) return;

  const { usd, mxn } = buildConceptosFromCostos(args.costosInternos, args.tasaIva);
  // Bug 6: la escritura es incondicional. Con el guard `length > 0` anterior, al
  // borrar todos los costos de una moneda el concepto de venta de esa moneda
  // quedaba huérfano y el paso 3 bloqueaba por "monedas mezcladas".
  args.setConceptosUSD(usd);
  args.setConceptosMXN(mxn);
  args.lastCostosHash.current = hashActual;
  if (!args.costosPreLlenados) args.setCostosPreLlenados(true);
}
