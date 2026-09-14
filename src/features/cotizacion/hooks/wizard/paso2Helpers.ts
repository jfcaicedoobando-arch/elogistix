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
import { costosSinConcepto, costosSinProveedor, tieneImportes } from "@/features/cotizacion/domain/cotizacionVentaSync";
import { costosPaso2Schema, primerError } from "@/features/cotizacion/domain/schemas/wizardPasos";
import type { DesajusteCostos } from "@/features/cotizacion/domain/costosAutoGenerados";
import { firmaCostos } from "./wizardStepsTypes";
import type { FilaCostoLocal } from "@/features/cotizacion/types";
import type { ConceptoVentaCotizacion } from "@/features/cotizacion/hooks/useCotizaciones";

/**
 * Q7 (v13.823.396): una fila cuenta como costo sólo si tiene importes reales y
 * cantidad positiva. Las filas completamente vacías pueden coexistir mientras
 * exista al menos una válida.
 */
export function filaCostoConImporte(fila: FilaCostoLocal): boolean {
  return tieneImportes(fila) && Number(fila.cantidad ?? 0) > 0;
}

/** true = el paso 2 es válido; false = ya se notificó el error al usuario. */
export function validarPaso2(
  costosInternos: FilaCostoLocal[],
  desajusteAutomaticos: DesajusteCostos | null = null,
): boolean {
  const sinConcepto = costosSinConcepto(costosInternos);
  // v13.823.305 (COT-2026-0245): sin proveedor el costo llega al embarque sin a
  // quién pagarle, así que se pide aquí y no al crear el expediente.
  const sinProveedor = costosSinProveedor(costosInternos);
  const errorPaso2 = primerError(costosPaso2Schema, {
    totalCostos: costosInternos.length,
    renglonesSinConcepto: sinConcepto.length,
    renglonesSinProveedor: sinProveedor.length,
    renglonesConImporte: costosInternos.filter(filaCostoConImporte).length,
    desajusteAutomaticos,
  });
  if (!errorPaso2) return true;

  notifyError(undefined, {
    title: errorPaso2,
    description: descripcionErrorPaso2(sinConcepto, sinProveedor, desajusteAutomaticos),
  });
  return false;
}

/** Detalle del error del paso 2, con los conceptos culpables por nombre. */
function descripcionErrorPaso2(
  sinConcepto: FilaCostoLocal[],
  sinProveedor: FilaCostoLocal[],
  desajuste: DesajusteCostos | null,
): string {
  if (sinConcepto.length > 0) {
    return `Selecciona el concepto de ${sinConcepto.length === 1 ? "1 renglón" : `${sinConcepto.length} renglones`} con importes capturados; sin nombre no se genera el concepto de venta.`;
  }
  if (sinProveedor.length > 0) {
    const nombres = sinProveedor.map((f) => f.concepto.trim() || "(sin concepto)").join(", ");
    return `Captura el proveedor de: ${nombres}. Sin proveedor el costo llega al expediente sin a quién pagarle.`;
  }
  if (desajuste) {
    // Q2/Q6: la acción de recalcular vive en el aviso del paso 2; sólo reemplaza
    // las filas automáticas y conserva las capturadas a mano.
    return "Usa el botón del aviso para recalcular; tus renglones capturados a mano se conservan.";
  }
  return "El paso 3 usa los costos del paso 2 para generar los conceptos de venta.";
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
