/**
 * useTimbrarFacturaDialog — extrae el estado + efecto + handler de
 * `DialogTimbrarFactura` para mantener el componente por debajo de las
 * 200 líneas (Power of 10).
 * Las mutaciones separan guardar datos, timbrar y enviar el CFDI confirmado.
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
import { queryKeys } from "@/lib/query";
import { logger } from "@/lib/observability/logger";
import { formaPagoParaMetodo } from "@/lib/financial/formaMetodoPago";
import { esPendiente } from "@/features/facturacion/services/timbradoPendiente";

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
  { emailDestino, open = true }: { emailDestino?: string | null; open?: boolean } = {},
) {
  const qc = useQueryClient();
  const timbrar = useTimbrarFactura();
  const { toast } = useToast();
  const initial = resolverDefaults(factura, cliente, defaults);
  const [usoCfdi, setUsoCfdi] = useState(initial.usoCfdi);
  const [formaPago, setFormaPago] = useState(initial.formaPago);
  const [metodoPago, setMetodoPago] = useState(initial.metodoPago);
  const [enviarEmail, setEnviarEmail] = useState(false);
  const [modoExpandido, setModoExpandido] = useState(false);

  // Mutación 1 — persiste los datos fiscales elegidos antes del timbrado.
  const actualizarDatos = useMutation({
    mutationKey: queryKeys.facturacion.actualizarDatosTimbrado,
    mutationFn: (v: ActualizarDatosVars) =>
      actualizarDatosTimbradoFactura(v.facturaId, {
        uso_cfdi: v.uso_cfdi, forma_pago: v.forma_pago, metodo_pago: v.metodo_pago,
      }),
    onError: (err, vars) => {
      notifyError(undefined, {
        title: "No se pudieron guardar los datos fiscales",
        description: getErrorMessage(err),
        error: err,
        method: "FACTURACION_GUARDAR_DATOS_TIMBRADO",
        context: { facturaId: vars.facturaId },
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
      logger.warn("timbrado", "no se guardaron los defaults del cliente:", err);
    },
  });

  // Mutación 3 — envío del CFDI por email tras timbrado exitoso.
  const enviarCfdi = useMutation({
    mutationKey: queryKeys.facturacion.enviarCfdiEmail,
    mutationFn: (v: { facturaId: string; email: string }) => enviarCfdiFactura(v.facturaId, v.email),
    onSuccess: (r) => {
      toast({ title: "CFDI enviado", description: `Enviado a ${r.enviado_a}.` });
    },
    onError: (err, vars) => {
      notifyError(undefined, {
        title: "Factura timbrada, pero no se envió el email",
        description: getErrorMessage(err),
        error: err,
        method: "FACTURACION_ENVIAR_EMAIL_TRAS_TIMBRADO",
        context: { facturaId: vars.facturaId },
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

  useEffect(() => { setEnviarEmail(false); }, [facturaId, open, emailDestino]);

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
      onSuccess: async (res) => {
        // Un 202 aún no es CFDI timbrado: no autoriza enviar correo.
        if (esPendiente(res)) { onClose(); return; }
        if (factura.cliente_id) {
          await guardarDefaults.mutateAsync({
            clienteId: factura.cliente_id,
            uso_cfdi_default: usoCfdi,
            forma_pago_default: formaPago,
            metodo_pago_default: metodoPago,
          }).catch(() => undefined);
        }
        if (enviarEmail && emailDestino) {
          await enviarCfdi.mutateAsync({ facturaId: factura.id, email: emailDestino }).catch(() => undefined);
        }
        onClose();
      },
    });
  };

  // P1 · Auditoría fiscal — al cambiar PUE↔PPD la forma de pago se realinea
  // sola: PPD ⇒ 99 (Por definir) y PUE limpia el 99 para obligar a elegir la
  // forma real. Así no se timbra con un dato obsoleto.
  const cambiarMetodoPago = (valor: string) => {
    setMetodoPago(valor);
    setFormaPago(formaPagoParaMetodo(valor, formaPago));
  };

  return {
    usoCfdi, setUsoCfdi,
    formaPago, setFormaPago,
    metodoPago, setMetodoPago: cambiarMetodoPago,
    enviarEmail, setEnviarEmail,
    modoExpandido, setModoExpandido,
    timbrarPending: timbrar.isPending || actualizarDatos.isPending,
    onConfirm,
  };
}


