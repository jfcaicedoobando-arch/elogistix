/**
 * useTimbrarFacturaDialog — extrae el estado + efecto + handler de
 * `DialogTimbrarFactura` para mantener el componente por debajo de las
 * 200 líneas (Power of 10). No cambia la lógica: sólo la encapsula.
 */
import { useEffect, useState } from "react";
import {
  actualizarDatosTimbradoFactura,
  guardarDefaultsTimbradoCliente,
  type ClienteFiscalRow,
  type DefaultsFacturacionCliente,
} from "@/features/facturacion/services";
import { enviarCfdiFactura } from "@/features/facturacion/services/enviarCfdiEmail";
import { useTimbrarFactura } from "@/features/facturacion/hooks/useTimbrarFactura";
import { useToast } from "@/hooks/shared";
import { getErrorMessage } from "@/lib/errors/index";
import { notifyError } from "@/components/shared/utils/appFeedback";
import { ERROR_CODES } from "@/lib/domain/errorCatalog";

interface FacturaLike {
  id: string;
  cliente_id: string | null;
  uso_cfdi: string | null;
  forma_pago: string | null;
  metodo_pago: string | null;
}

function resolverDefaults(
  factura: FacturaLike | null | undefined,
  cliente: ClienteFiscalRow | null | undefined,
  defaults: DefaultsFacturacionCliente | null | undefined,
) {
  const usoCfdi = factura?.uso_cfdi ?? defaults?.uso_cfdi ?? cliente?.uso_cfdi_default ?? "G03";
  const formaPago = factura?.forma_pago ?? defaults?.forma_pago ?? "99";
  const metodoPago = factura?.metodo_pago ?? defaults?.metodo_pago ?? "PPD";
  return { usoCfdi, formaPago, metodoPago };
}

async function guardarDefaultsSiClienteExiste(
  clienteId: string | null,
  usoCfdi: string,
  formaPago: string,
  metodoPago: string,
) {
  if (!clienteId) return;
  try {
    await guardarDefaultsTimbradoCliente(clienteId, {
      uso_cfdi_default: usoCfdi,
      forma_pago_default: formaPago,
      metodo_pago_default: metodoPago,
    });
  } catch (err) {
    console.warn("[timbrado] no se guardaron los defaults del cliente:", err);
  }
}

async function enviarCfdiSiHabilitado(
  facturaId: string,
  habilitado: boolean,
  toast: ReturnType<typeof useToast>["toast"],
) {
  if (!habilitado) return;
  try {
    const r = await enviarCfdiFactura(facturaId);
    toast({ title: "CFDI enviado", description: `Enviado a ${r.enviado_a}.` });
  } catch (err) {
    notifyError(toast, {
      title: "Factura timbrada, pero no se envió el email",
      description: getErrorMessage(err),
      method: "ON_ERROR",
      errorCode: ERROR_CODES.VALIDATION_FAILED,
    });
  }
}

export function useTimbrarFacturaDialog(
  factura: FacturaLike | null | undefined,
  cliente: ClienteFiscalRow | null | undefined,
  defaults: DefaultsFacturacionCliente | null | undefined,
  onClose: () => void,
) {
  const timbrar = useTimbrarFactura();
  const { toast } = useToast();
  const initial = resolverDefaults(factura, cliente, defaults);
  const [usoCfdi, setUsoCfdi] = useState(initial.usoCfdi);
  const [formaPago, setFormaPago] = useState(initial.formaPago);
  const [metodoPago, setMetodoPago] = useState(initial.metodoPago);
  const [enviarEmail, setEnviarEmail] = useState(true);
  const [modoExpandido, setModoExpandido] = useState(false);

  useEffect(() => {
    if (!factura) return;
    const next = resolverDefaults(factura, cliente, defaults);
    setUsoCfdi(next.usoCfdi);
    setFormaPago(next.formaPago);
    setMetodoPago(next.metodoPago);
    setModoExpandido(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    factura?.id, factura?.uso_cfdi, factura?.forma_pago, factura?.metodo_pago,
    cliente?.uso_cfdi_default, defaults?.uso_cfdi, defaults?.forma_pago, defaults?.metodo_pago,
  ]);

  const onConfirm = async () => {
    if (!factura) return;
    await actualizarDatosTimbradoFactura(factura.id, {
      uso_cfdi: usoCfdi, forma_pago: formaPago, metodo_pago: metodoPago,
    });
    timbrar.mutate(factura.id, {
      onSuccess: async () => {
        await guardarDefaultsSiClienteExiste(factura.cliente_id, usoCfdi, formaPago, metodoPago);
        await enviarCfdiSiHabilitado(factura.id, enviarEmail, toast);
        onClose();
      },
    });
  };

  return {
    usoCfdi, setUsoCfdi,
    formaPago, setFormaPago,
    metodoPago, setMetodoPago,
    enviarEmail, setEnviarEmail,
    modoExpandido, setModoExpandido,
    timbrarPending: timbrar.isPending,
    onConfirm,
  };
}

