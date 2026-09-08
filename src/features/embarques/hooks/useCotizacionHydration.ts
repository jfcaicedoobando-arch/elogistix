/**
 * Hook que encapsula la pre-vinculación automática de una cotización
 * cuando el usuario navega desde `CotizacionDetalle` con state.
 *
 * Aísla el `useEffect` con guarda anti-doble-ejecución y el toast de
 * notificación, dejando el controller del wizard libre de plomería de
 * inicialización.
 */
import { useEffect, useRef } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useToast } from "@/hooks/shared";
import { useCotizacion, type CotizacionRow } from "@/features/cotizacion/hooks";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";
import { ERROR_CODES } from "@/lib/domain/errorCatalog";

/**
 * R215-COT-01: sólo estos estados permiten convertir a embarque (el guard del
 * backend es el mismo). Se valida ANTES de capturar los 4 pasos.
 */
const ESTADOS_CONVERTIBLES = ["Aceptada", "En operación"];

interface UseCotizacionHydrationArgs {
  onPrevincular: (cot: CotizacionRow) => void;
}

export function useCotizacionHydration({ onPrevincular }: UseCotizacionHydrationArgs) {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
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

    // R215-COT-01: si la cotización no está Aceptada / En operación, el backend
    // rechazará la conversión al final. Se avisa aquí y se regresa al detalle
    // en vez de dejar capturar los 4 pasos para nada.
    const estado = String((cotizacionPrevinculada as { estado?: string }).estado ?? "");
    if (!ESTADOS_CONVERTIBLES.includes(estado)) {
      notifyError(undefined, {
        title: "La cotización todavía no está aceptada",
        description: `${cotizacionPrevinculada.folio} está en ${estado || "Borrador"}. Acéptala para poder generar el embarque.`,
        method: "HIDRATAR_COTIZACION_EMBARQUE",
        errorCode: ERROR_CODES.VALIDATION_FAILED,
      });
      navigate(`/cotizaciones/${cotizacionPrevinculada.id}`, { replace: true });
      return;
    }

    onPrevincular(cotizacionPrevinculada);
    notifySuccess(undefined, {
      title: "Datos pre-rellenados",
      description: `Cotización ${cotizacionPrevinculada.folio} vinculada automáticamente.`});
    window.history.replaceState({}, "");
  }, [cotizacionPrevinculada, onPrevincular, toast, navigate]);
}
