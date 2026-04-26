import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/errors";
import {
  useUpdateEstadoCotizacion,
  useConvertirProspectoACliente,
  useConvertirCotizacionAEmbarques,
  type CotizacionRow,
} from "@/hooks/useCotizaciones";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";
import type { ClienteFormData } from "@/types/clienteForm";

/**
 * Hook focalizado en las acciones (mutations + handlers + diálogos) del detalle de cotización.
 * Separado del state de queries/totales para favorecer la testabilidad.
 */
export function useCotizacionDetalleHandlers(cotizacion: CotizacionRow | undefined) {
  const { toast } = useToast();
  const actualizarEstado = useUpdateEstadoCotizacion();
  const convertirProspecto = useConvertirProspectoACliente();
  const convertirAEmbarques = useConvertirCotizacionAEmbarques();

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
    } catch (err: unknown) {
      notifyError(toast, { title: "Error", description: getErrorMessage(err)});
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
      notifyError(toast, { title: "El nombre es obligatorio"});
      return;
    }
    try {
      const cliente = await convertirProspecto.mutateAsync({
        cotizacionId: cotizacion.id,
        clienteData: clienteForm,
      });
      notifySuccess(toast, { title: `Cliente "${cliente.nombre}" creado exitosamente` });
      setShowConvertir(false);
    } catch (err: unknown) {
      notifyError(toast, { title: "Error al convertir prospecto", description: getErrorMessage(err)});
    }
  };

  const handleGenerarEmbarques = async () => {
    if (!cotizacion) return;
    try {
      await convertirAEmbarques.mutateAsync(cotizacion);
      notifySuccess(toast, { title: `Se generaron ${cotizacion.num_contenedores} embarques exitosamente` });
      setShowConfirmarConvertir(false);
    } catch (err: unknown) {
      notifyError(toast, { title: "Error al generar embarques", description: getErrorMessage(err)});
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
    convertirProspecto,
    convertirAEmbarques,
  };
}
