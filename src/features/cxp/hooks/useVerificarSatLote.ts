/**
 * Validación masiva del estatus SAT para facturas de proveedor.
 *
 * Corre SECUENCIAL (el servicio del SAT es lento y rechaza ráfagas) e invalida
 * las queries una sola vez al final. Devuelve un resumen agrupado por estatus.
 *
 * v13.428.0
 */
import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  verificarUuidSat,
  type EstatusSat,
} from "@/features/cxp/services/verificarUuidSat";
import { notifyError, notifySuccess, notifyWarning } from "@/lib/ui/appFeedback";
import { queryKeys } from "@/lib/query";

const METHOD = "USE_VERIFICAR_SAT_LOTE";

export interface ResumenSatLote {
  vigentes: string[];
  canceladas: string[];
  noEncontradas: string[];
  noVerificables: string[];
  fallos: Array<{ id: string; error: string }>;
}

function vacio(): ResumenSatLote {
  return { vigentes: [], canceladas: [], noEncontradas: [], noVerificables: [], fallos: [] };
}

function clasificar(res: ResumenSatLote, id: string, estatus: EstatusSat): void {
  if (estatus === "Vigente") res.vigentes.push(id);
  else if (estatus === "Cancelado") res.canceladas.push(id);
  else if (estatus === "No Encontrado") res.noEncontradas.push(id);
  else res.noVerificables.push(id);
}

function describir(r: ResumenSatLote): string {
  const partes: string[] = [];
  if (r.vigentes.length) partes.push(`${r.vigentes.length} vigente(s)`);
  if (r.canceladas.length) partes.push(`${r.canceladas.length} cancelada(s)`);
  if (r.noEncontradas.length) partes.push(`${r.noEncontradas.length} no encontrada(s)`);
  if (r.noVerificables.length) partes.push(`${r.noVerificables.length} no verificable(s)`);
  if (r.fallos.length) partes.push(`${r.fallos.length} con error`);
  return partes.join(" · ");
}

export function useVerificarSatLote() {
  const qc = useQueryClient();
  const [isRunning, setIsRunning] = useState(false);
  const [progreso, setProgreso] = useState<{ hecho: number; total: number } | null>(null);

  const verificar = useCallback(
    async (ids: readonly string[]): Promise<ResumenSatLote> => {
      const resumen = vacio();
      if (ids.length === 0) return resumen;

      setIsRunning(true);
      setProgreso({ hecho: 0, total: ids.length });

      for (let i = 0; i < ids.length; i++) {
        const id = ids[i];
        try {
          const res = await verificarUuidSat(id, "cxp");
          clasificar(resumen, id, res.estatus);
        } catch (e) {
          resumen.fallos.push({ id, error: e instanceof Error ? e.message : String(e) });
        }
        setProgreso({ hecho: i + 1, total: ids.length });
      }

      qc.invalidateQueries({ queryKey: queryKeys.cxp.all });
      qc.invalidateQueries({ queryKey: queryKeys.proveedorFacturas.all });

      const detalle = describir(resumen);
      const conProblema =
        resumen.canceladas.length + resumen.noEncontradas.length + resumen.noVerificables.length;

      if (resumen.fallos.length === ids.length) {
        notifyError(undefined, {
          title: "No se pudo validar ninguna factura en el SAT",
          description: resumen.fallos[0].error,
          method: METHOD,
        });
      } else if (conProblema > 0 || resumen.fallos.length > 0) {
        notifyWarning(undefined, {
          title: `Validación SAT terminada: ${detalle}`,
          description: "Revisa las facturas marcadas antes de aprobarlas.",
          duration: 9000,
        });
      } else {
        notifySuccess(undefined, {
          title: `${resumen.vigentes.length} factura(s) vigente(s) en el SAT`,
          description: "Ya puedes aprobarlas en lote.",
        });
      }

      setIsRunning(false);
      setProgreso(null);
      return resumen;
    },
    [qc],
  );

  return { verificar, isRunning, progreso };
}
