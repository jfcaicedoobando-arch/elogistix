/**
 * Hook para aprobar múltiples facturas de proveedor en lote (Ola B · B4).
 *
 * Corre las llamadas de forma SECUENCIAL (no paralelas) para no saturar la RPC
 * ni disparar tormenta de invalidaciones. Reporta progreso y agrega
 * `{ exitos, fallos }` con detalle por id.
 *
 * FP-000221: las facturas sin embarque exigen justificación escrita. El lote
 * la recibe una sola vez y la envía SÓLO a las facturas que la requieren.
 */
import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  aprobarFacturaProveedor,
  AprobacionFacturaError,
} from "@/features/cxp/services/aprobacionFactura";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";
import { queryKeys } from "@/lib/query";

export interface ResultadoLote {
  exitos: string[];
  fallos: Array<{ id: string; error: string }>;
}

export interface OpcionesLote {
  /** Justificación del gasto para las facturas sin embarque. */
  justificacion?: string;
  /** Ids que requieren la justificación (facturas sin embarque). */
  requierenJustificacion?: ReadonlySet<string>;
}

/** Errores de validación de negocio ya explicados al usuario: no son bugs. */
const VALIDACIONES_NEGOCIO = [
  "captura los conceptos",
  "no cuadra",
  "no está en estado",
  "sin permiso",
  // Ola 4 (H2): respaldo mínimo. Se aprueban una por una con justificación.
  "no está ligada",
  "excede el monto",
  // FP-000221: textos vigentes del respaldo mínimo y del monto máximo.
  "escribe la justificación",
  "monto que puede aprobarse",
];

function esValidacionNegocio(msg: string): boolean {
  const m = msg.toLowerCase();
  return VALIDACIONES_NEGOCIO.some((v) => m.includes(v));
}


/** Avisa el resultado del lote (éxito total, fallo total o mixto). */
function avisarResultado(
  exitos: readonly string[],
  fallos: ReadonlyArray<{ id: string; error: string }>,
  primerCodigo?: string,
): void {
  if (fallos.length === 0) {
    notifySuccess(undefined, {
      title: exitos.length === 1 ? "Factura aprobada" : `${exitos.length} facturas aprobadas`,
      description: "Todas las solicitudes de la selección se aprobaron correctamente.",
    });
    return;
  }
  if (exitos.length > 0) {
    notifySuccess(undefined, {
      title: `${exitos.length} aprobada(s), ${fallos.length} con error`,
      description: "Revisa las facturas que fallaron para reintentar manualmente.",
    });
    return;
  }
  const primero = fallos[0].error;
  // Sentry JAVASCRIPT-REACT-3V: las validaciones de negocio (p. ej. "captura los
  // conceptos antes de aprobar") no son fallas técnicas: se muestran al usuario
  // pero no se reportan como excepción.
  notifyError(undefined, {
    // v13.339.0 (Q-02): pluralización correcta y causa real del servidor.
    title:
      fallos.length === 1
        ? "No se pudo aprobar la factura"
        : `No se pudieron aprobar ${fallos.length} facturas`,
    description: primero,
    error: esValidacionNegocio(primero) ? undefined : new Error(primero),
    errorCode: primerCodigo,
    method: "USE_APROBAR_FACTURAS_LOTE",
  });
}


export function useAprobarFacturasLote() {
  const qc = useQueryClient();
  const [isRunning, setIsRunning] = useState(false);
  const [progreso, setProgreso] = useState<{ hecho: number; total: number } | null>(null);

  const aprobar = useCallback(
    async (ids: readonly string[], opciones?: OpcionesLote): Promise<ResultadoLote> => {
      if (ids.length === 0) return { exitos: [], fallos: [] };
      setIsRunning(true);
      setProgreso({ hecho: 0, total: ids.length });

      const exitos: string[] = [];
      const fallos: Array<{ id: string; error: string }> = [];
      const justificacion = opciones?.justificacion?.trim() || undefined;
      const requieren = opciones?.requierenJustificacion;
      /** Primer código de dominio observado, para reportar honesto el aviso. */
      let primerCodigo: string | undefined;

      for (let i = 0; i < ids.length; i++) {
        const id = ids[i];
        const motivo = requieren?.has(id) ? justificacion : undefined;
        try {
          await aprobarFacturaProveedor(id, true, motivo);
          exitos.push(id);
        } catch (e) {
          if (!primerCodigo && e instanceof AprobacionFacturaError) primerCodigo = e.code;
          fallos.push({ id, error: e instanceof Error ? e.message : String(e) });
        }
        setProgreso({ hecho: i + 1, total: ids.length });
      }

      // Invalida una sola vez al final.
      qc.invalidateQueries({ queryKey: queryKeys.cxp.all });
      qc.invalidateQueries({ queryKey: queryKeys.proveedorFacturas.all });
      qc.invalidateQueries({ queryKey: queryKeys.bandejas.all });

      avisarResultado(exitos, fallos, primerCodigo);

      setIsRunning(false);
      setProgreso(null);
      return { exitos, fallos };
    },
    [qc],
  );

  return { aprobar, isRunning, progreso };
}
