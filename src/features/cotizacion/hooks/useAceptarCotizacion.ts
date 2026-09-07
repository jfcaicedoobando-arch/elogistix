/**
 * Flujo de confirmación para ACEPTAR una cotización.
 *
 * Aceptar no es sólo un cambio de estado: el trigger
 * `crm_cerrar_oportunidad_desde_cotizacion` cierra la oportunidad como Ganada
 * con el monto y la fecha de hoy. Este hook:
 *   1. Explica eso antes de ejecutar (diálogo de confirmación).
 *   2. Detecta el choque de monedas cotización/oportunidad, que la base
 *      rechaza con `LC_MONEDA_INCOMPATIBLE`, y permite alinearlas en el mismo
 *      paso en lugar de mandar al usuario a CRM.
 */
import { useCallback, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  fetchMonedaOportunidad,
  alinearMonedaOportunidad,
} from "@/features/crm/services/monedaOportunidad";
import { notifySuccess, notifyError } from "@/lib/ui/appFeedback";

export interface AceptarCotizacionInput {
  oportunidadId: string | null;
  monedaCotizacion: string | null;
  /** Ejecuta el cambio de estado real (mutación de cotización). */
  aplicarEstado: (estado: string) => Promise<void>;
}

export function useAceptarCotizacion({
  oportunidadId,
  monedaCotizacion,
  aplicarEstado,
}: AceptarCotizacionInput) {
  const [open, setOpen] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const monedaQuery = useQuery({
    queryKey: ["crm", "oportunidad-moneda", oportunidadId],
    queryFn: () => fetchMonedaOportunidad(oportunidadId as string),
    enabled: open && !!oportunidadId,
    staleTime: 0,
  });

  const monedaOportunidad = monedaQuery.data ?? null;
  const hayChoqueMoneda =
    !!oportunidadId
    && !!monedaCotizacion
    && !!monedaOportunidad
    && monedaOportunidad !== monedaCotizacion;

  const abrir = useCallback(() => setOpen(true), []);

  const confirmar = useCallback(async () => {
    if (enviando) return;
    setEnviando(true);
    try {
      if (hayChoqueMoneda && oportunidadId && monedaCotizacion) {
        const ok = await alinearMonedaOportunidad(oportunidadId, monedaCotizacion);
        if (!ok) {
          notifyError(undefined, {
            title: "No pudimos actualizar la moneda de la oportunidad",
            description:
              "La oportunidad ya no existe o no tienes acceso a ella. Revísala en CRM antes de aceptar.",
          });
          return;
        }
      }
      await aplicarEstado("Aceptada");
      setOpen(false);
      if (oportunidadId) {
        notifySuccess(undefined, {
          title: "Cotización aceptada",
          description: "La oportunidad quedó cerrada como Ganada con el monto de esta cotización.",
        });
      }
    } catch {
      // El toast de error lo emite la mutación / el normalizador de errores.
    } finally {
      setEnviando(false);
      void monedaQuery.refetch();
    }
  }, [
    enviando, hayChoqueMoneda, oportunidadId, monedaCotizacion,
    aplicarEstado, monedaQuery,
  ]);

  return {
    open,
    setOpen,
    abrir,
    confirmar,
    enviando,
    cargandoMoneda: monedaQuery.isLoading,
    hayChoqueMoneda,
    monedaOportunidad,
  };
}
