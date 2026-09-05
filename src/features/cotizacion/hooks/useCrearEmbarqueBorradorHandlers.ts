/**
 * Handlers de creación de embarque borrador (con candado de costos y manejo
 * de revalidación de tarifa), extraídos de `useCotizacionDetalleHandlers`
 * para mantenerlo bajo el límite de líneas (Power-of-10); sin cambios de
 * comportamiento.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { useCrearEmbarqueBorrador, type CotizacionRow } from "@/features/cotizacion/hooks/useCotizaciones";
import { useRegistrarActividad } from "@/hooks/shared";
import { tieneCostosCargados } from "@/features/cotizacion/services/candadoCostos";
import { notifyWarning } from "@/lib/ui/appFeedback";
import { RevalidacionRequeridaError } from "@/features/cotizacion/domain/revalidacionTarifa";

export function useCrearEmbarqueBorradorHandlers(cotizacion: CotizacionRow | undefined) {
  const navigate = useNavigate();
  const crearBorrador = useCrearEmbarqueBorrador();
  const registrarActividad = useRegistrarActividad();

  const [showConfirmarConvertir, setShowConfirmarConvertir] = useState(false);
  const [showBloqueoSinCostos, setShowBloqueoSinCostos] = useState(false);

  /**
   * Candado: bloquea la creación de embarque(s) si la cotización no tiene costos cargados.
   * Registra el bloqueo en bitácora para auditoría.
   */
  const validarCostosOBloquear = async (cotizacionId: string, accion: string): Promise<boolean> => {
    const ok = await tieneCostosCargados(cotizacionId);
    if (!ok) {
      try {
        registrarActividad.mutate({
          accion: "embarque_bloqueado_sin_costos",
          modulo: "cotizaciones",
          entidad_id: cotizacionId,
          entidad_nombre: "",
          detalles: { accion_intentada: accion },
        });
      } catch {
        // No bloquear UX por fallo de bitácora.
      }
      setShowConfirmarConvertir(false);
      setShowBloqueoSinCostos(true);
    }
    return ok;
  };

  const manejarErrorRevalidacion = (err: unknown, _method: string): boolean => {
    if (err instanceof RevalidacionRequeridaError) {
      notifyWarning(undefined, {
        title: "Tarifa desactualizada",
        description:
          "La tarifa de esta cotización cambió o venció. Usa el botón \"Crear embarque\" del detalle para revalidar (mantener, refrescar, sustituir o pedir reaprobación).",
      });
      return true;
    }
    return false;
  };

  // FIX-07 (v13.303.12) — `handleGenerarEmbarques` (multi-await sin
  // transacción) se removió. La UI usa `handleCrearBorrador` que llama a la
  // RPC transaccional `crear_embarque_borrador_desde_cotizacion`.
  const handleCrearBorrador = async () => {
    if (!cotizacion) return;
    const ok = await validarCostosOBloquear(cotizacion.id, "crear_borrador");
    if (!ok) return;
    try {
      const embarqueId = await crearBorrador.mutateAsync(cotizacion.id);
      // El toast lo emite `useCrearEmbarqueBorrador` (evita doble toast).
      navigate(`/embarques/${embarqueId}`);
    } catch (err: unknown) {
      manejarErrorRevalidacion(err, "HANDLE_CREAR_BORRADOR");
    }
  };

  const irACargarCostos = () => {
    if (!cotizacion) return;
    setShowBloqueoSinCostos(false);
    navigate(`/cotizaciones/${cotizacion.id}/editar`);
  };

  return {
    crearBorrador,
    showConfirmarConvertir,
    setShowConfirmarConvertir,
    showBloqueoSinCostos,
    setShowBloqueoSinCostos,
    handleCrearBorrador,
    irACargarCostos,
  };
}
