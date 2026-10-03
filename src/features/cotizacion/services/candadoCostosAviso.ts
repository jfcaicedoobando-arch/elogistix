/**
 * v13.823.370 (P1-1) — Candado de costos con aviso, reutilizable por las rutas
 * de conversión cotización → embarque.
 *
 * La ruta real de producción (`CrearEmbarqueConRevalidacion`) no pasaba por
 * `tieneCostosCargados` — ese candado sólo vivía en
 * `useCrearEmbarqueBorradorHandlers` — así que una cotización Aceptada con
 * venta pero SIN desglose de costos llegaba a revalidar y crear el borrador.
 *
 * Es fail-closed: si la verificación misma falla (red/permisos) NO se procede.
 * El servidor lo refuerza con `LC_COT_SIN_COSTOS` para llamadas directas a la RPC.
 *
 * Extraído a su propio módulo para respetar el techo de 200 líneas por archivo.
 */
import {
  tieneCostosCargados,
  CandadoCostosNoVerificableError,
} from "@/features/cotizacion/services/candadoCostos";
import { notifyWarning } from "@/lib/ui/appFeedback";

/** true si la cotización tiene costos cargados; false (con aviso) en cualquier otro caso. */
export async function verificarCostosOAvisar(cotizacionId: string): Promise<boolean> {
  try {
    if (await tieneCostosCargados(cotizacionId)) return true;
    notifyWarning(undefined, {
      title: "La cotización no tiene costos cargados",
      description:
        "Captura el desglose de costos en la cotización (paso 2) antes de crear el embarque.",
    });
    return false;
  } catch (err) {
    if (err instanceof CandadoCostosNoVerificableError) {
      notifyWarning(undefined, {
        title: "No pudimos verificar los costos",
        description:
          "No se pudo comprobar si la cotización tiene costos cargados. Revisa tu conexión e inténtalo de nuevo.",
      });
      return false;
    }
    throw err;
  }
}
