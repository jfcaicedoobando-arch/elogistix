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
