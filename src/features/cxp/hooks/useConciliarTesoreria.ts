/**
 * Conciliación automática de tesorería en CxP (v13.396.0).
 *
 * Al abrir el detalle de la factura se concilia sola (una vez), y el usuario
 * puede volver a lanzarla manualmente. Al terminar invalida las consultas de
 * CxP y tesorería para que el saldo y el estatus mostrados sean los recién
 * recalculados.
 */
import { useEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import {
  conciliarTesoreriaProveedor,
  type ConciliarTesoreriaInput,
  type ReporteConciliacion,
} from "@/features/cxp/services";
import { notifyError } from "@/lib/ui/appFeedback";

export function useConciliarTesoreria() {
  const qc = useQueryClient();
  return useMutation<ReporteConciliacion, Error, ConciliarTesoreriaInput>({
    mutationFn: conciliarTesoreriaProveedor,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.cxp.all });
      qc.invalidateQueries({ queryKey: queryKeys.tesoreria.all });
    },
    onError: (error) => {
      notifyError(undefined, {
        title: "No se pudo conciliar la tesorería",
        error,
        method: "CONCILIAR_TESORERIA_PROVEEDOR",
      });
    },
  });
}

/**
 * Dispara la conciliación una sola vez por factura (al montar el detalle).
 * `habilitado` en falso evita lanzarla cuando el rol no tiene permiso de
 * escritura (la BD responde 42501 y aparecería un toast de error en cada
 * apertura del detalle).
 * Devuelve la mutación para poder relanzarla y leer el reporte.
 */
export function useConciliacionAutomaticaFactura(
  facturaId: string | null,
  habilitado = true,
) {
  const conciliar = useConciliarTesoreria();
  const yaConciliado = useRef<string | null>(null);
  const { mutate } = conciliar;

  useEffect(() => {
    if (!habilitado || !facturaId || yaConciliado.current === facturaId) return;
    yaConciliado.current = facturaId;
    mutate({ facturaId });
  }, [facturaId, habilitado, mutate]);

  return conciliar;
}

