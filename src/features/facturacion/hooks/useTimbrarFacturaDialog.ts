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

export function useTimbrarFacturaDialog(
  factura: FacturaLike | null | undefined,
  cliente: ClienteFiscalRow | null | undefined,
  defaults: DefaultsFacturacionCliente | null | undefined,
  onClose: () => void,
) {
  const timbrar = useTimbrarFactura();
  const { toast } = useToast();
  const [usoCfdi, setUsoCfdi] = useState(
    factura?.uso_cfdi ?? defaults?.uso_cfdi ?? cliente?.uso_cfdi_default ?? "G03",
  );
  const [formaPago, setFormaPago] = useState(factura?.forma_pago ?? defaults?.forma_pago ?? "03");
  const [metodoPago, setMetodoPago] = useState(factura?.metodo_pago ?? defaults?.metodo_pago ?? "PUE");
  const [enviarEmail, setEnviarEmail] = useState(true);
  const [modoExpandido, setModoExpandido] = useState(false);

  useEffect(() => {
    if (!factura) return;
    setUsoCfdi(factura.uso_cfdi ?? defaults?.uso_cfdi ?? cliente?.uso_cfdi_default ?? "G03");
    setFormaPago(factura.forma_pago ?? defaults?.forma_pago ?? "03");
    setMetodoPago(factura.metodo_pago ?? defaults?.metodo_pago ?? "PUE");
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
        if (factura.cliente_id) {
          try {
            await guardarDefaultsTimbradoCliente(factura.cliente_id, {
              uso_cfdi_default: usoCfdi,
              forma_pago_default: formaPago,
              metodo_pago_default: metodoPago,
            });
          } catch (err) {
            console.warn("[timbrado] no se guardaron los defaults del cliente:", err);
          }
        }
        if (enviarEmail) {
          try {
            const r = await enviarCfdiFactura(factura.id);
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
