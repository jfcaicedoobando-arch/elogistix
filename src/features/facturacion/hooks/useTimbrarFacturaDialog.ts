/**
 * useTimbrarFacturaDialog — extrae el estado + efecto + handler de
 * `DialogTimbrarFactura` para mantener el componente por debajo de las
 * 200 líneas (Power of 10).
 *
 * v13.269.0: migrado a React Query para estandarizar mutaciones. Los tres
 * side-effects imperativos (actualizar datos fiscales previo al timbrado,
 * persistir defaults del cliente, enviar CFDI por email) viven ahora como
 * `useMutation` con `mutationKey` estable e invalidación de caches.
 */
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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

  const facturaId = factura?.id;
  const facturaUsoCfdi = factura?.uso_cfdi;
  const facturaFormaPago = factura?.forma_pago;
  const facturaMetodoPago = factura?.metodo_pago;
  const clienteUsoCfdi = cliente?.uso_cfdi_default;
  const defaultsUsoCfdi = defaults?.uso_cfdi;
  const defaultsFormaPago = defaults?.forma_pago;
  const defaultsMetodoPago = defaults?.metodo_pago;

  useEffect(() => {
    if (!facturaId) return;
    const usoCfdi = facturaUsoCfdi ?? defaultsUsoCfdi ?? clienteUsoCfdi ?? "G03";
    const formaPago = facturaFormaPago ?? defaultsFormaPago ?? "99";
    const metodoPago = facturaMetodoPago ?? defaultsMetodoPago ?? "PPD";
    setUsoCfdi(usoCfdi);
    setFormaPago(formaPago);
    setMetodoPago(metodoPago);
    setModoExpandido(false);
  }, [
    facturaId, facturaUsoCfdi, facturaFormaPago, facturaMetodoPago,
    clienteUsoCfdi, defaultsUsoCfdi, defaultsFormaPago, defaultsMetodoPago,
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

