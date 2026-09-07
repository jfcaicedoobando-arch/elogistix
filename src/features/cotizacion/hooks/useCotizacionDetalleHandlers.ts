import { useUpdateEstadoCotizacion, type CotizacionRow } from "@/features/cotizacion/hooks/useCotizaciones";
import { notifyWarning } from "@/lib/ui/appFeedback";
import { sincronizarEtapaPorEstadoCotizacion } from "@/features/crm/services/vincularCotizacion";
import { useConvertirProspectoHandlers } from "@/features/cotizacion/hooks/useConvertirProspectoHandlers";
import { useCrearEmbarqueBorradorHandlers } from "@/features/cotizacion/hooks/useCrearEmbarqueBorradorHandlers";
import { useAceptarCotizacion } from "@/features/cotizacion/hooks/useAceptarCotizacion";

/**
 * Estados cuya etapa CRM sigue sincronizándose desde el cliente. Los estados
 * terminales (`Aceptada`, `En operación`) y `Rechazada` los gobierna la base de
 * datos: sincronizarlos aquí duplicaba escrituras y podía perder la oportunidad.
 */
const ESTADOS_SYNC_CLIENTE = ["Enviada", "Solicitada"];

/**
 * Hook focalizado en las acciones (mutations + handlers + diálogos) del detalle de cotización.
 * Separado del state de queries/totales para favorecer la testabilidad.
 * Los handlers de conversión de prospecto y de creación de embarque borrador
 * viven en hooks dedicados (`useConvertirProspectoHandlers`,
 * `useCrearEmbarqueBorradorHandlers`) para mantener este archivo corto.
 */
export function useCotizacionDetalleHandlers(cotizacion: CotizacionRow | undefined) {
  const actualizarEstado = useUpdateEstadoCotizacion();
  const conversion = useConvertirProspectoHandlers(cotizacion);
  const embarqueBorrador = useCrearEmbarqueBorradorHandlers(cotizacion);

  const aplicarEstado = useCallback(async (estado: string) => {
    if (!cotizacion) return;
    {
      await actualizarEstado.mutateAsync({ id: cotizacion.id, estado });
      // El toast de éxito/error lo emite `useUpdateEstadoCotizacion` (evita doble toast).
      // v13.823.57 — la BD es dueña de los estados terminales: el trigger
      // `zz_crm_cerrar_oportunidad_desde_cotizacion` cierra la oportunidad al
      // aceptar/operar. Rechazar tampoco pierde la oportunidad (puede haber
      // otra alternativa viva). Sólo sincronizamos estados no terminales.
      if (cotizacion.oportunidad_id && ESTADOS_SYNC_CLIENTE.includes(estado)) {
        try {
          await sincronizarEtapaPorEstadoCotizacion({
            oportunidadId: cotizacion.oportunidad_id,
            estadoCotizacion: estado,
          });
        } catch {
          // P2 (13.823.142): el cambio de cotización YA quedó guardado; sólo
          // falló la sincronización CRM. Avisamos sin sugerir que todo falló y
          // sin repetir la mutación exitosa.
          notifyWarning(undefined, {
            title: "Estado guardado; el CRM no se actualizó",
            description:
              "Revisa la oportunidad en CRM y vuelve a guardar el estado para reintentar la sincronización.",
          });
        }
      }
    } catch {
      // Notificado por el hook de mutación.
    }
  };

  return {
    showConvertir: conversion.showConvertir,
    setShowConvertir: conversion.setShowConvertir,
    showConfirmarConvertir: embarqueBorrador.showConfirmarConvertir,
    setShowConfirmarConvertir: embarqueBorrador.setShowConfirmarConvertir,
    showBloqueoSinCostos: embarqueBorrador.showBloqueoSinCostos,
    setShowBloqueoSinCostos: embarqueBorrador.setShowBloqueoSinCostos,
    clienteForm: conversion.clienteForm,
    setClienteForm: conversion.setClienteForm,
    handleCambiarEstado,
    abrirDialogConvertir: conversion.abrirDialogConvertir,
    handleConvertir: conversion.handleConvertir,
    handleCrearBorrador: embarqueBorrador.handleCrearBorrador,
    irACargarCostos: embarqueBorrador.irACargarCostos,
    convertirProspecto: conversion.convertirProspecto,
    crearBorrador: embarqueBorrador.crearBorrador,
  };
}
