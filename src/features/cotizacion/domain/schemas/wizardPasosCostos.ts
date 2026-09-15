/**
 * Paso 2 · Costos internos del wizard de cotización.
 *
 * Separado de `wizardPasos.ts` para respetar el límite de 200 líneas
 * (Power of 10 #4). Se reexporta desde ahí para preservar los imports
 * públicos existentes. Sin dependencias de UI.
 */
import { z } from "zod";
import { COPY_VALIDACION } from "@/lib/copy/publicoCopy";

export const costosPaso2Schema = z
  .object({
    totalCostos: z.number(),
    renglonesSinConcepto: z.number(),
    /** v13.823.305: renglones con importes y sin proveedor capturado. */
    renglonesSinProveedor: z.number().default(0),
    /**
     * Q7 (v13.823.396): renglones con importes reales. Antes se contaba
     * `costosInternos.length`, así que una fila completamente vacía valía como
     * costo y el error aparecía después, en el paso 3, hablando de conceptos.
     */
    renglonesConImporte: z.number().default(0),
    /**
     * Q2/Q6 (v13.823.396): los costos automáticos ya no corresponden al Paso 1
     * (cantidad de contenedores o entradas del flete LCL). Se exige recalcular.
     */
    desajusteAutomaticos: z.enum(["tarifa_cantidad", "flete_lcl"]).nullish(),
  })
  .superRefine((v, ctx) => {
    if (v.totalCostos === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["totalCostos"],
        message: COPY_VALIDACION.costosInternosRequeridos,
      });
      return;
    }
    if (v.renglonesSinConcepto > 0) {
      ctx.addIssue({
        code: "custom",
        path: ["renglonesSinConcepto"],
        message: COPY_VALIDACION.renglonesSinConcepto,
      });
      return;
    }
    if (v.renglonesSinProveedor > 0) {
      ctx.addIssue({
        code: "custom",
        path: ["renglonesSinProveedor"],
        message: COPY_VALIDACION.renglonesSinProveedor,
      });
      return;
    }
    if (v.renglonesConImporte === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["renglonesConImporte"],
        message: COPY_VALIDACION.costosInternosSinImporte,
      });
      return;
    }
    if (v.desajusteAutomaticos) {
      ctx.addIssue({
        code: "custom",
        path: ["desajusteAutomaticos"],
        message:
          v.desajusteAutomaticos === "tarifa_cantidad"
            ? COPY_VALIDACION.costosTarifaDesactualizados
            : COPY_VALIDACION.costosFleteLclDesactualizado,
      });
    }
  });
