/**
 * Helpers puros del orquestador de submit de embarque.
 * Sin React, sin hooks. Aíslan derivaciones de payload y reporte de errores
 * para mantener el hook orquestador ≤200 LOC con margen (Power-of-10 #4).
 */
import { notifyError } from "@/lib/ui/appFeedback";
import { getErrorMessage } from "@/lib/errors";
import type { ContenedorBorrador } from "@/features/embarques/types/contenedor";

const METHOD_TAG = "USE_EMBARQUE_SUBMIT_ORCHESTRATOR";

/**
 * Reglas: marítimo LCL → fila auto-LCL única usando peso/volumen/piezas del form;
 * marítimo FCL → contenedores del form;
 * cualquier otro modo (Aéreo/Terrestre) → vacío.
 */
export function deriveContenedoresPayload(values: {
  modo: string;
  tipoServicio?: string;
  contenedores?: ContenedorBorrador[];
  pesoKg?: number | string;
  volumenM3?: number | string;
  piezas?: number | string;
}): ContenedorBorrador[] {
  if (values.modo !== "Marítimo") return [];
  if (values.tipoServicio === "LCL") {
    return [{
      numero_contenedor: "",
      tipo_contenedor: "LCL",
      bl_house: "",
      peso_kg: Number(values.pesoKg) || 0,
      volumen_m3: Number(values.volumenM3) || 0,
      piezas: Number(values.piezas) || 0,
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
  _toast: Parameters<typeof notifyError>[0],
  title: string,
  err: unknown,
): false {
  notifyError(undefined, {
    title,
    description: getErrorMessage(err),
    error: err,
    method: METHOD_TAG,
  });
  return false;
}

/**
 * B-05 — Reintenta la vinculación de la cotización (fase 4) con backoff
 * exponencial (500 ms, 1000 ms). La operación es idempotente: sólo fija estado
 * y `embarque_id`. Devuelve el último error o `null` si tuvo éxito.
 */
export async function vincularCotizacionConReintentos(
  intentar: () => Promise<unknown>,
  maxReintentos = 2,
): Promise<unknown> {
  let ultimoError: unknown = null;
  for (let intento = 0; intento <= maxReintentos; intento++) {
    try {
      await intentar();
      return null;
    } catch (err: unknown) {
      ultimoError = err;
      if (intento < maxReintentos) {
        await new Promise((r) => setTimeout(r, 500 * 2 ** intento));
      }
    }
  }
  return ultimoError;
}
