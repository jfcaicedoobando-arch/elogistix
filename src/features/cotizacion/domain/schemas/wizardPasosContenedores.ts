/**
 * Paso 1 · Contenedores (sólo Marítimo FCL).
 *
 * Separado de `wizardPasos.ts` para respetar el límite de 200 líneas
 * (Power of 10 #4). Sin dependencias de UI.
 */
import { z } from "zod";
import { COPY_VALIDACION } from "@/lib/copy/publicoCopy";

/**
 * BL-COT-04: una cotización Marítimo FCL se define por contenedor(es). Antes
 * la regla fuerte sólo existía al convertir a embarque, así que se guardaban
 * cotizaciones FCL con 0. LCL y los modos no marítimos no usan este dato.
 *
 * Q1 (v13.823.396): además del número, FCL exige el TIPO de contenedor. El
 * progreso de "Mercancía" ya lo pintaba incompleto, pero "Siguiente" no lo
 * validaba y el hijo FCL del embarque se insertaba con el tipo vacío.
 */
export const contenedoresMaritimoSchema = z
  .object({
    modo: z.string().default(""),
    tipoEmbarque: z.string().default(""),
    numContenedores: z.coerce.number().default(0),
    tipoContenedor: z.string().nullable().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.modo !== "Marítimo" || v.tipoEmbarque !== "FCL") return;
    if (v.numContenedores < 1) {
      ctx.addIssue({
        code: "custom",
        path: ["numContenedores"],
        message: COPY_VALIDACION.contenedoresRequeridos,
      });
      return;
    }
    if (!String(v.tipoContenedor ?? "").trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["tipoContenedor"],
        message: COPY_VALIDACION.tipoContenedorRequerido,
      });
    }
  });
