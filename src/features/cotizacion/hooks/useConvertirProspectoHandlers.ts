/**
 * Handlers de conversión de prospecto a cliente, extraídos de
 * `useCotizacionDetalleHandlers` para mantenerlo bajo el límite de líneas
 * (Power-of-10); sin cambios de comportamiento.
 */
import { useState } from "react";

import {
  useConvertirProspectoACliente,
  type CotizacionRow,
} from "@/features/cotizacion/hooks/useCotizaciones";
import { fetchDatosFiscalesProspecto } from "@/features/cotizacion/services/datosFiscalesProspecto";
import { notifyError } from "@/lib/ui/appFeedback";
import { EMPTY_CLIENTE_FORM, type ClienteFormData } from "@/features/cliente/types/clienteForm";
import { validarClienteConversion } from "@/features/cliente/domain/validarClienteConversion";
import { ERROR_CODES } from "@/lib/domain/errorCatalog";

export function useConvertirProspectoHandlers(cotizacion: CotizacionRow | undefined) {
  const convertirProspecto = useConvertirProspectoACliente();
  const [showConvertir, setShowConvertir] = useState(false);
  const [clienteForm, setClienteForm] = useState<ClienteFormData>({ ...EMPTY_CLIENTE_FORM });

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

  return {
    convertirProspecto,
    showConvertir,
    setShowConvertir,
    clienteForm,
    setClienteForm,
    abrirDialogConvertir,
    handleConvertir,
  };
}
