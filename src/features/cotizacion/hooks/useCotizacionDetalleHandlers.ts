import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/shared";
import { getErrorMessage } from "@/lib/errors";
import {
  useUpdateEstadoCotizacion,
  useConvertirProspectoACliente,
  useConvertirCotizacionAEmbarques,
  useCrearEmbarqueBorrador,
  type CotizacionRow,
} from "@/features/cotizacion/hooks/useCotizaciones";
import { useRegistrarActividad } from "@/hooks/shared";
import { tieneCostosCargados } from "@/features/cotizacion/services/candadoCostos";
import { notifyError, notifySuccess, notifyWarning } from "@/components/shared/utils/appFeedback";
import { sincronizarEtapaPorEstadoCotizacion, propagarConversionProspectoCRM } from "@/features/crm/services/vincularCotizacion";
import type { ClienteFormData } from "@/features/cliente/types/clienteForm";
import { RevalidacionRequeridaError } from "@/features/cotizacion/domain/revalidacionTarifa";


import { ERROR_CODES } from "@/lib/domain/errorCatalog";


/**
 * Hook focalizado en las acciones (mutations + handlers + diálogos) del detalle de cotización.
 * Separado del state de queries/totales para favorecer la testabilidad.
 */
export function useCotizacionDetalleHandlers(cotizacion: CotizacionRow | undefined) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const actualizarEstado = useUpdateEstadoCotizacion();
  const convertirProspecto = useConvertirProspectoACliente();
  const convertirAEmbarques = useConvertirCotizacionAEmbarques();
  const crearBorrador = useCrearEmbarqueBorrador();
  const registrarActividad = useRegistrarActividad();


  const [showConvertir, setShowConvertir] = useState(false);
  const [showConfirmarConvertir, setShowConfirmarConvertir] = useState(false);
  const [showBloqueoSinCostos, setShowBloqueoSinCostos] = useState(false);
  const [clienteForm, setClienteForm] = useState<ClienteFormData>({
    nombre: '', contacto: '', email: '', telefono: '',
    rfc: '', direccion: '', ciudad: '', estado: '', cp: '',
  });

  const handleCambiarEstado = async (estado: string) => {
    if (!cotizacion) return;
    try {
      await actualizarEstado.mutateAsync({ id: cotizacion.id, estado });
      notifySuccess(toast, { title: `Estado actualizado a "${estado}"` });
      if (cotizacion.oportunidad_id) {
        try {
          await sincronizarEtapaPorEstadoCotizacion({
            oportunidadId: cotizacion.oportunidad_id,
            estadoCotizacion: estado,
          });
        } catch {
          // No bloquear el cambio de estado de la cotización por una falla CRM.
        }
      }
    } catch (err: unknown) {
      notifyError(toast, { title: "Error", description: getErrorMessage(err), error: err, method: "HANDLE_CAMBIAR_ESTADO" });
    }
  };

  const abrirDialogConvertir = () => {
    if (!cotizacion) return;
    setClienteForm({
      nombre: cotizacion.prospecto_empresa || '',
      contacto: cotizacion.prospecto_contacto || '',
      email: cotizacion.prospecto_email || '',
      telefono: cotizacion.prospecto_telefono || '',
      rfc: '', direccion: '', ciudad: '', estado: '', cp: '',
    });
    setShowConvertir(true);
  };

  const handleConvertir = async () => {
    if (!cotizacion || !clienteForm.nombre.trim()) {
      notifyError(toast, { title: "El nombre es obligatorio", method: "HANDLE_CONVERTIR", errorCode: ERROR_CODES.VALIDATION_FAILED });
      return;
    }
    try {
      const cliente = await convertirProspecto.mutateAsync({
        cotizacionId: cotizacion.id,
        clienteData: clienteForm,
      });
      notifySuccess(toast, { title: `Cliente "${cliente.nombre}" creado exitosamente` });
      if (cotizacion.oportunidad_id) {
        try {
          await propagarConversionProspectoCRM({
            oportunidadId: cotizacion.oportunidad_id,
            clienteId: cliente.id,
            clienteNombre: cliente.nombre,
          });
        } catch {
          // No bloquear la conversión de prospecto por una falla CRM.
        }
      }
      setShowConvertir(false);
    } catch (err: unknown) {
      notifyError(toast, { title: "Error al convertir prospecto", description: getErrorMessage(err), error: err, method: "HANDLE_CONVERTIR" });
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
      notifyWarning(toast, {
        title: "Tarifa desactualizada",
        description:
          "La tarifa de esta cotización cambió o venció. Usa el botón \"Crear embarque\" del detalle para revalidar (mantener, refrescar, sustituir o pedir reaprobación).",
      });
      return true;
    }
    return false;
  };


  const handleGenerarEmbarques = async () => {
    if (!cotizacion) return;
    const ok = await validarCostosOBloquear(cotizacion.id, "generar_embarques");
    if (!ok) return;
    try {
      await convertirAEmbarques.mutateAsync(cotizacion);
      notifySuccess(toast, { title: `Se generaron ${cotizacion.num_contenedores} embarques exitosamente` });
      setShowConfirmarConvertir(false);
    } catch (err: unknown) {
      if (manejarErrorRevalidacion(err, "HANDLE_GENERAR_EMBARQUES")) return;
      notifyError(toast, { title: "Error al generar embarques", description: getErrorMessage(err), error: err, method: "HANDLE_GENERAR_EMBARQUES" });
    }
  };

  const handleCrearBorrador = async () => {
    if (!cotizacion) return;
    const ok = await validarCostosOBloquear(cotizacion.id, "crear_borrador");
    if (!ok) return;
    try {
      const embarqueId = await crearBorrador.mutateAsync(cotizacion.id);
      notifySuccess(toast, { title: "Embarque borrador creado", description: "Complétalo y confírmalo cuando esté listo." });
      navigate(`/embarques/${embarqueId}`);
    } catch (err: unknown) {
      if (manejarErrorRevalidacion(err, "HANDLE_CREAR_BORRADOR")) return;
      notifyError(toast, { title: "Error al crear el borrador", description: getErrorMessage(err), error: err, method: "HANDLE_CREAR_BORRADOR" });
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
    handleGenerarEmbarques,
    handleCrearBorrador,
    irACargarCostos,
    convertirProspecto,
    convertirAEmbarques,
    crearBorrador,
  };
}
