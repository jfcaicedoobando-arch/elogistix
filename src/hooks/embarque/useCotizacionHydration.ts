/**
 * Hook que encapsula la pre-vinculación automática de una cotización
 * cuando el usuario navega desde `CotizacionDetalle` con state.
 *
 * Aísla el `useEffect` con guarda anti-doble-ejecución y el toast de
 * notificación, dejando el controller del wizard libre de plomería de
 * inicialización.
 */
import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useCotizacion, type CotizacionRow } from "@/hooks/useCotizaciones";
import { notifySuccess } from "@/lib/ui/appFeedback";

interface UseCotizacionHydrationArgs {
  onPrevincular: (cot: CotizacionRow) => void;
}

export function useCotizacionHydration({ onPrevincular }: UseCotizacionHydrationArgs) {
  const location = useLocation();
  const { toast } = useToast();

  const cotizacionPrevinculadaId = (
    location.state as { cotizacionPrevinculadaId?: string } | null
  )?.cotizacionPrevinculadaId;

  const { data: cotizacionPrevinculada } = useCotizacion(cotizacionPrevinculadaId);

  const yaPrevinculadoRef = useRef(false);
  useEffect(() => {
    if (yaPrevinculadoRef.current) return;
    if (!cotizacionPrevinculada) return;
    yaPrevinculadoRef.current = true;
    onPrevincular(cotizacionPrevinculada);
    notifySuccess(toast, {
      title: "Datos pre-rellenados",
      description: `Cotización ${cotizacionPrevinculada.folio} vinculada automáticamente.`});
    window.history.replaceState({}, "");
  }, [cotizacionPrevinculada, onPrevincular, toast]);
}
