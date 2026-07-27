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
import { notifyError } from "@/lib/ui/appFeedback";
import { ERROR_CODES } from "@/lib/domain/errorCatalog";
import { queryKeys } from "@/lib/query";

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


interface ActualizarDatosVars {
  facturaId: string;
  uso_cfdi: string;
  forma_pago: string;
  metodo_pago: string;
}

interface GuardarDefaultsVars {
  clienteId: string;
  uso_cfdi_default: string;
  forma_pago_default: string;
  metodo_pago_default: string;
}

export function useTimbrarFacturaDialog(
  factura: FacturaLike | null | undefined,
  cliente: ClienteFiscalRow | null | undefined,
  defaults: DefaultsFacturacionCliente | null | undefined,
  onClose: () => void,
) {
  const qc = useQueryClient();
  const timbrar = useTimbrarFactura();
  const { toast } = useToast();
  const initial = resolverDefaults(factura, cliente, defaults);
  const [usoCfdi, setUsoCfdi] = useState(initial.usoCfdi);
  const [formaPago, setFormaPago] = useState(initial.formaPago);
  const [metodoPago, setMetodoPago] = useState(initial.metodoPago);
  const [enviarEmail, setEnviarEmail] = useState(true);
  const [modoExpandido, setModoExpandido] = useState(false);

  // Mutación 1 — persiste los datos fiscales elegidos antes del timbrado.
  const actualizarDatos = useMutation({
    mutationKey: queryKeys.facturacion.actualizarDatosTimbrado,
    mutationFn: (v: ActualizarDatosVars) =>
      actualizarDatosTimbradoFactura(v.facturaId, {
        uso_cfdi: v.uso_cfdi, forma_pago: v.forma_pago, metodo_pago: v.metodo_pago,
      }),
    onError: (err) => {
      notifyError(undefined, {
        title: "No se pudieron guardar los datos fiscales",
        description: getErrorMessage(err),
        method: "ON_ERROR",
        errorCode: ERROR_CODES.VALIDATION_FAILED,
      });
    },
  });

  // Mutación 2 — guarda defaults del cliente. Best-effort: no bloquea el flujo.
  const guardarDefaults = useMutation({
    mutationKey: queryKeys.facturacion.guardarDefaultsCliente,
    mutationFn: (v: GuardarDefaultsVars) =>
      guardarDefaultsTimbradoCliente(v.clienteId, {
        uso_cfdi_default: v.uso_cfdi_default,
        forma_pago_default: v.forma_pago_default,
        metodo_pago_default: v.metodo_pago_default,
      }),
    onSuccess: (_r, v) => {
      qc.invalidateQueries({ queryKey: queryKeys.facturacion.clienteDefaults(v.clienteId) });
    },
    onError: (err) => {
      // best-effort: sólo warning, no rompe el timbrado ya exitoso.
      console.warn("[timbrado] no se guardaron los defaults del cliente:", err);
    },
  });

  // Mutación 3 — envío del CFDI por email tras timbrado exitoso.
  const enviarCfdi = useMutation({
    mutationKey: queryKeys.facturacion.enviarCfdiEmail,
    mutationFn: (facturaId: string) => enviarCfdiFactura(facturaId),
    onSuccess: (r) => {
      toast({ title: "CFDI enviado", description: `Enviado a ${r.enviado_a}.` });
    },
    onError: (err) => {
      notifyError(undefined, {
        title: "Factura timbrada, pero no se envió el email",
        description: getErrorMessage(err),
        method: "ON_ERROR",
        errorCode: ERROR_CODES.VALIDATION_FAILED,
      });
    },
  });

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
    await actualizarDatos.mutateAsync({
      facturaId: factura.id, uso_cfdi: usoCfdi, forma_pago: formaPago, metodo_pago: metodoPago,
    });
    timbrar.mutate(factura.id, {
      onSuccess: async () => {
        if (factura.cliente_id) {
          await guardarDefaults.mutateAsync({
            clienteId: factura.cliente_id,
            uso_cfdi_default: usoCfdi,
            forma_pago_default: formaPago,
            metodo_pago_default: metodoPago,
          }).catch(() => undefined);
        }
        if (enviarEmail) {
          await enviarCfdi.mutateAsync(factura.id).catch(() => undefined);
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
    timbrarPending: timbrar.isPending || actualizarDatos.isPending,
    onConfirm,
  };
}


