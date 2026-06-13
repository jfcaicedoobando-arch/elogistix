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
} from "@/hooks/cotizacion/useCotizaciones";
import { notifyError, notifySuccess } from "@/components/shared/utils/appFeedback";
import { sincronizarEtapaPorEstadoCotizacion, propagarConversionProspectoCRM } from "@/features/crm/services/vincularCotizacion";
import type { ClienteFormData } from "@/types/clienteForm";

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


  const [showConvertir, setShowConvertir] = useState(false);
  const [showConfirmarConvertir, setShowConfirmarConvertir] = useState(false);
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

  const handleGenerarEmbarques = async () => {
    if (!cotizacion) return;
    try {
      await convertirAEmbarques.mutateAsync(cotizacion);
      notifySuccess(toast, { title: `Se generaron ${cotizacion.num_contenedores} embarques exitosamente` });
      setShowConfirmarConvertir(false);
    } catch (err: unknown) {
      notifyError(toast, { title: "Error al generar embarques", description: getErrorMessage(err), error: err, method: "HANDLE_GENERAR_EMBARQUES" });
    }
  };

  const handleCrearBorrador = async () => {
    if (!cotizacion) return;
    try {
      const embarqueId = await crearBorrador.mutateAsync(cotizacion.id);
      notifySuccess(toast, { title: "Embarque borrador creado", description: "Complétalo y confírmalo cuando esté listo." });
      navigate(`/embarques/${embarqueId}`);
    } catch (err: unknown) {
      notifyError(toast, { title: "Error al crear el borrador", description: getErrorMessage(err), error: err, method: "HANDLE_CREAR_BORRADOR" });
    }
  };

  return {
    showConvertir, setShowConvertir,
    showConfirmarConvertir, setShowConfirmarConvertir,
    clienteForm, setClienteForm,
    handleCambiarEstado,
    abrirDialogConvertir,
    handleConvertir,
    handleGenerarEmbarques,
    handleCrearBorrador,
    convertirProspecto,
    convertirAEmbarques,
    crearBorrador,
  };
}

