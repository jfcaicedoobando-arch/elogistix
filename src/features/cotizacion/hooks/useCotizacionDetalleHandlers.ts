import { useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  useUpdateEstadoCotizacion,
  useConvertirProspectoACliente,
  useCrearEmbarqueBorrador,
  type CotizacionRow,
} from "@/features/cotizacion/hooks/useCotizaciones";
import { useRegistrarActividad } from "@/hooks/shared";
import { tieneCostosCargados } from "@/features/cotizacion/services/candadoCostos";
import { fetchDatosFiscalesProspecto } from "@/features/cotizacion/services/datosFiscalesProspecto";
import { notifyError, notifyWarning } from "@/lib/ui/appFeedback";
import { sincronizarEtapaPorEstadoCotizacion } from "@/features/crm/services/vincularCotizacion";
import { EMPTY_CLIENTE_FORM, type ClienteFormData } from "@/features/cliente/types/clienteForm";
import { validarClienteConversion } from "@/features/cliente/domain/validarClienteConversion";
import { RevalidacionRequeridaError } from "@/features/cotizacion/domain/revalidacionTarifa";


import { ERROR_CODES } from "@/lib/domain/errorCatalog";

/**
 * Estados cuya etapa CRM sigue sincronizándose desde el cliente. Los estados
 * terminales (`Aceptada`, `En operación`) y `Rechazada` los gobierna la base de
 * datos: sincronizarlos aquí duplicaba escrituras y podía perder la oportunidad.
 */
const ESTADOS_SYNC_CLIENTE = ["Enviada", "Solicitada"];



/**
 * Hook focalizado en las acciones (mutations + handlers + diálogos) del detalle de cotización.
 * Separado del state de queries/totales para favorecer la testabilidad.
 */
export function useCotizacionDetalleHandlers(cotizacion: CotizacionRow | undefined) {
  const navigate = useNavigate();
  const actualizarEstado = useUpdateEstadoCotizacion();
  const convertirProspecto = useConvertirProspectoACliente();
  const crearBorrador = useCrearEmbarqueBorrador();
  const registrarActividad = useRegistrarActividad();


  const [showConvertir, setShowConvertir] = useState(false);
  const [showConfirmarConvertir, setShowConfirmarConvertir] = useState(false);
  const [showBloqueoSinCostos, setShowBloqueoSinCostos] = useState(false);
  const [clienteForm, setClienteForm] = useState<ClienteFormData>({ ...EMPTY_CLIENTE_FORM });

  const handleCambiarEstado = async (estado: string) => {
    if (!cotizacion) return;
    try {
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


  /** Precarga contacto + datos fiscales del lead: el vendedor no recaptura nada. */
  const abrirDialogConvertir = async () => {
    if (!cotizacion) return;
    const fiscales = await fetchDatosFiscalesProspecto(cotizacion.oportunidad_id ?? null);
    setClienteForm({
      ...EMPTY_CLIENTE_FORM,
      nombre: cotizacion.prospecto_empresa || '',
      contacto: cotizacion.prospecto_contacto || '',
      email: cotizacion.prospecto_email || '',
      telefono: cotizacion.prospecto_telefono || '',
      ...fiscales,
    });
    setShowConvertir(true);
  };

  /**
   * P0 — una sola llamada: la RPC hace cliente + cotización + historial +
   * oportunidad + lead + bitácora en una transacción. Ya NO se propaga al CRM
   * después (antes podía quedar el cliente creado y el CRM sin actualizar).
   */
  const handleConvertir = async () => {
    if (!cotizacion) return;
    const errores = validarClienteConversion(clienteForm);
    const faltantes = Object.values(errores);
    if (faltantes.length > 0) {
      notifyError(undefined, {
        title: "Faltan datos del cliente",
        description: faltantes[0],
        method: "HANDLE_CONVERTIR",
        errorCode: ERROR_CODES.VALIDATION_FAILED,
      });
      return;
    }
    try {
      await convertirProspecto.mutateAsync({
        cotizacionId: cotizacion.id,
        clienteData: clienteForm,
      });
      // El toast lo emite `useConvertirProspectoACliente` (evita doble toast) y
      // sus invalidaciones ya terminaron cuando llegamos aquí.
      setShowConvertir(false);
    } catch {
      // Notificado por el hook de mutación; el diálogo NO se cierra.
    }
  };

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
    showConvertir, setShowConvertir,
    showConfirmarConvertir, setShowConfirmarConvertir,
    showBloqueoSinCostos, setShowBloqueoSinCostos,
    clienteForm, setClienteForm,
    handleCambiarEstado,
    abrirDialogConvertir,
    handleConvertir,
    handleCrearBorrador,
    irACargarCostos,
    convertirProspecto,
    crearBorrador,
  };
}
