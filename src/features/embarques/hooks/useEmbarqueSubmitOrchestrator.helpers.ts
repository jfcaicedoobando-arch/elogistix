/**
 * Helpers puros del orquestador de submit de embarque.
 * Sin React, sin hooks. Aíslan derivaciones de payload y reporte de errores
 * para mantener el hook orquestador ≤200 LOC con margen (Power-of-10 #4).
 */
import { notifyError } from "@/components/shared/utils/appFeedback";
import { getErrorMessage } from "@/lib/errors";
import type { ContenedorBorrador } from "@/features/embarques/types/contenedor";

const METHOD_TAG = "USE_EMBARQUE_SUBMIT_ORCHESTRATOR";

/**
 * Reglas: marítimo LCL → fila auto-LCL única; marítimo FCL → contenedores del form;
 * cualquier otro modo (Aéreo/Terrestre) → vacío.
 */
export function deriveContenedoresPayload(values: {
  modo: string;
  tipoServicio?: string;
  contenedores?: ContenedorBorrador[];
}): ContenedorBorrador[] {
  if (values.modo !== "Marítimo") return [];
  if (values.tipoServicio === "LCL") {
    return [{
      numero_contenedor: "",
      tipo_contenedor: "LCL",
      bl_house: "",
      peso_kg: 0,
      volumen_m3: 0,
      piezas: 0,
      orden: 1,
    }];
  }
  return values.contenedores ?? [];
}

/**
 * Reporta un error de fase con el tag de método y el mensaje extraído.
 * Devuelve `false` por conveniencia para usarse en `return reportPhaseError(...)`.
 */
export function reportPhaseError(
  toast: Parameters<typeof notifyError>[0],
  title: string,
  err: unknown,
): false {
  notifyError(toast, {
    title,
    description: getErrorMessage(err),
    error: err,
    method: METHOD_TAG,
  });
  return false;
}
