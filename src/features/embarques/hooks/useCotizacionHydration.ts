/**
 * Hook que encapsula la pre-vinculación automática de una cotización
 * cuando el usuario navega desde `CotizacionDetalle` con state.
 *
 * Aísla el `useEffect` con guarda anti-doble-ejecución y el toast de
 * notificación, dejando el controller del wizard libre de plomería de
 * inicialización.
 */
import { useEffect, useRef } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { useToast } from "@/hooks/shared";
import { useCotizacion, type CotizacionRow } from "@/features/cotizacion/hooks";
import { notifySuccess } from "@/lib/ui/appFeedback";

interface UseCotizacionHydrationArgs {
  onPrevincular: (cot: CotizacionRow) => void;
}

export function useCotizacionHydration({ onPrevincular }: UseCotizacionHydrationArgs) {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  // B-013 (v13.320.34): honrar ambos vehículos — `location.state` (navegación
  // programática) y `?fromCotizacion=` en la URL (redirect post-guardado del
  // diálogo de NuevaCotizacion). Antes, sólo se leía state, así que la ruta
  // con querystring rebotaba al listado con toast de error.
  const cotizacionPrevinculadaId =
    (location.state as { cotizacionPrevinculadaId?: string } | null)?.cotizacionPrevinculadaId
    ?? searchParams.get("fromCotizacion")
    ?? undefined;

  const { data: cotizacionPrevinculada } = useCotizacion(cotizacionPrevinculadaId);

  const yaPrevinculadoRef = useRef(false);
  useEffect(() => {
    if (yaPrevinculadoRef.current) return;
    if (!cotizacionPrevinculada) return;
    yaPrevinculadoRef.current = true;
    onPrevincular(cotizacionPrevinculada);
    notifySuccess(undefined, {
      title: "Datos pre-rellenados",
      description: `Cotización ${cotizacionPrevinculada.folio} vinculada automáticamente.`});
    window.history.replaceState({}, "");
  }, [cotizacionPrevinculada, onPrevincular, toast]);
}
