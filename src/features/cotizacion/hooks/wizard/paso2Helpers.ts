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
import type { FilaCostoLocal } from "@/features/cotizacion/types/pl";
import type { ConceptoVenta } from "@/features/cotizacion/types/conceptos";

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
  setConceptosUSD: (c: ConceptoVenta[]) => void;
  setConceptosMXN: (c: ConceptoVenta[]) => void;
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
  if (usd.length > 0) args.setConceptosUSD(usd);
  if (mxn.length > 0) args.setConceptosMXN(mxn);
  args.lastCostosHash.current = hashActual;
  if (!args.costosPreLlenados) args.setCostosPreLlenados(true);
}
