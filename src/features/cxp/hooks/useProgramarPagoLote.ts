/**
 * Hook para programar el pago de varias facturas de proveedor en lote
 * (QW7). Corre `programarPagoProveedor` SECUENCIALMENTE (patrón de
 * `useAprobarFacturasLote`) y reporta `{ exitos, fallos }` con progreso.
 */
import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { programarPagoProveedor } from "@/features/cxp/services/programarPagoProveedor";
import { notifySuccess, notifyWarning } from "@/lib/ui/appFeedback";
import { queryKeys } from "@/lib/query";

export interface ResultadoLoteProgramacion {
  exitos: string[];
  fallos: Array<{ id: string; error: string }>;
}

export function useProgramarPagoLote() {
  const qc = useQueryClient();
  const [isRunning, setIsRunning] = useState(false);
  const [progreso, setProgreso] = useState<{ hecho: number; total: number } | null>(null);

  const programar = useCallback(
    async (ids: readonly string[], fecha: string): Promise<ResultadoLoteProgramacion> => {
      if (ids.length === 0) return { exitos: [], fallos: [] };
      setIsRunning(true);
      setProgreso({ hecho: 0, total: ids.length });

      const exitos: string[] = [];
      const fallos: Array<{ id: string; error: string }> = [];

      for (let i = 0; i < ids.length; i++) {
        const id = ids[i];
        try {
          await programarPagoProveedor(id, fecha);
          exitos.push(id);
        } catch (e) {
          fallos.push({ id, error: e instanceof Error ? e.message : String(e) });
        }
        setProgreso({ hecho: i + 1, total: ids.length });
      }

      qc.invalidateQueries({ queryKey: queryKeys.cxp.all });
      qc.invalidateQueries({ queryKey: queryKeys.proveedorFacturas.all });
      qc.invalidateQueries({ queryKey: queryKeys.tesoreria.all });
      qc.invalidateQueries({ queryKey: queryKeys.bandejas.all });

      if (fallos.length === 0) {
        notifySuccess(toast, {
          title: `${exitos.length} factura(s) programada(s) para ${fecha}`,
        });
      } else {
        notifyWarning(toast, {
          title: `${exitos.length} programada(s), ${fallos.length} con error`,
          description: "Revisa las facturas que fallaron para reintentar manualmente.",
        });
      }

      setIsRunning(false);
      setProgreso(null);
      return { exitos, fallos };
    },
    [qc],
  );

  return { programar, isRunning, progreso };
}
