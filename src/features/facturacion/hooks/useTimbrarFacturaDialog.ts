/**
 * useTimbrarFacturaDialog — extrae el estado + efecto + handler de
 * `DialogTimbrarFactura` para mantener el componente por debajo de las
 * 200 líneas (Power of 10).
 * Las mutaciones separan guardar datos, timbrar y enviar el CFDI confirmado.
 */
import { buildEstadoTimbrado } from "../utils/estadoTimbrado";
import { usoCfdiParaPreferencia } from "../utils/usoCfdiTimbrado";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient, useMutationState } from "@tanstack/react-query";
import {
  actualizarDatosTimbradoFactura,
  guardarDefaultsTimbradoCliente,
  type ClienteFiscalRow,
  type DatosTimbradoPatch,
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
  organization_id?: string;
  rfc_cliente?: string | null;
  moneda?: string | null;
  tipo_cambio?: number | string | null;
  uso_cfdi: string | null;
  forma_pago: string | null;
  metodo_pago: string | null;
}

function resolverDefaults(
  factura: FacturaLike | null | undefined,
  cliente: ClienteFiscalRow | null | undefined,
  defaults: DefaultsFacturacionCliente | null | undefined,
) {
  const usoCfdi = factura?.uso_cfdi ?? cliente?.uso_cfdi_default ?? defaults?.uso_cfdi ?? "G03";
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
  uso_cfdi_default?: string;
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
  const autosaveKey = queryKeys.facturacion.autosaveDatosTimbrado(factura?.id, factura?.organization_id);
  const autosaves = useMutationState({ filters: { mutationKey: autosaveKey }, select: (m) => ({
    status: m.state.status, patch: patchAutosave(m.state),
  }) });
  const datosFiscalesError = autosaves.some((m) => m.status === "error");
  const initial = resolverDefaults(factura, cliente, defaults);
  const [usoCfdi, setUsoCfdi] = useState(initial.usoCfdi);
  const usoEditado = useRef(false);
  const apertura = useRef({ facturaId: factura?.id, open });
  const elegirUsoCfdi = (valor: string) => { usoEditado.current = true; setUsoCfdi(valor); };
  const [formaPago, setFormaPago] = useState(initial.formaPago);
  const [metodoPago, setMetodoPago] = useState(initial.metodoPago);
  const formaEditada = useRef(false);
  const metodoEditado = useRef(false);
  const [enviarEmail, setEnviarEmail] = useState(false);
  const [modoExpandido, setModoExpandido] = useState(false);
  const sinConciliar = (patch?: Partial<DatosTimbradoPatch>) => camposAutosaveSinConciliar(patch, factura, {
    uso_cfdi: usoEditado.current ? undefined : usoCfdi,
    forma_pago: formaEditada.current ? undefined : formaPago,
    metodo_pago: metodoEditado.current ? undefined : metodoPago,
  });
  const confirmado = Object.assign({}, ...autosaves.filter((m) => m.status === "success").map((m) => m.patch));
  const datosFiscalesPending = autosavePendiente(autosaves, sinConciliar(confirmado));
  const datosFiscalesSinGuardar = datosFiscalesPending || datosFiscalesError;

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
        ...(v.uso_cfdi_default ? { uso_cfdi_default: v.uso_cfdi_default } : {}),
        forma_pago_default: v.forma_pago_default,
        metodo_pago_default: v.metodo_pago_default,
      }),
    onSuccess: (_r, v) => {
      // La preferencia explícita precede al RPC: ambas cachés deben reflejar la escritura.
      const fiscalKey = queryKeys.facturacion.clienteFiscal(v.clienteId);
      qc.setQueryData<ClienteFiscalRow | null>(fiscalKey, (cached) =>
        cached && v.uso_cfdi_default ? { ...cached, uso_cfdi_default: v.uso_cfdi_default } : cached);
      qc.invalidateQueries({ queryKey: fiscalKey });
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
    if (apertura.current.facturaId !== facturaId || apertura.current.open !== open) {
      usoEditado.current = false; formaEditada.current = false; metodoEditado.current = false;
    }
    apertura.current = { facturaId, open };
    if (!facturaId) return;
    const usoCfdi = facturaUsoCfdi ?? clienteUsoCfdi ?? defaultsUsoCfdi ?? "G03";
    const formaPago = facturaFormaPago ?? defaultsFormaPago ?? "99";
    const metodoPago = facturaMetodoPago ?? defaultsMetodoPago ?? "PPD";
    if (!usoEditado.current) setUsoCfdi(usoCfdi);
    if (!formaEditada.current) setFormaPago(formaPago);
    if (!metodoEditado.current) setMetodoPago(metodoPago);
    setModoExpandido(false);
  }, [
    open, facturaId, facturaUsoCfdi, facturaFormaPago, facturaMetodoPago,
    clienteUsoCfdi, defaultsUsoCfdi, defaultsFormaPago, defaultsMetodoPago,
  ]);

  const onConfirm = async () => {
    if (!factura || !open || timbrar.isPending || actualizarDatos.isPending) return;
    const capturas = qc.getMutationCache().findAll({ mutationKey: autosaveKey });
    if (capturas.some((m) => m.state.status === "pending" || m.state.status === "error")) return;
    const confirmado = Object.assign({}, ...capturas.filter((m) => m.state.status === "success").map((m) => patchAutosave(m.state)));
    if (sinConciliar(confirmado)) return;
    const preflight = buildEstadoTimbrado(factura, cliente, { usoCfdi, formaPago, metodoPago });
    if (!preflight.puedeTimbrar) {
      notifyError(undefined, { title: "Revisa los datos fiscales antes de timbrar",
        description: preflight.checks.filter((c) => !c.ok).map((c) => c.label).join(" "),
        method: "FACTURACION_PREFLIGHT_TIMBRADO", context: { facturaId: factura.id } });
      return;
    }
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
            uso_cfdi_default: usoCfdiParaPreferencia(res, {
              rfc: cliente?.rfc ?? "", regimen: cliente?.regimen_fiscal ?? "", usoCfdi,
            }),
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
    metodoEditado.current = true; formaEditada.current = true;
    setMetodoPago(valor);
    setFormaPago(formaPagoParaMetodo(valor, formaPago));
  };

  return {
    usoCfdi, setUsoCfdi: elegirUsoCfdi,
    formaPago, setFormaPago: (valor: string) => { formaEditada.current = true; setFormaPago(valor); },
    metodoPago, setMetodoPago: cambiarMetodoPago,
    enviarEmail, setEnviarEmail,
    modoExpandido, setModoExpandido,
    datosFiscalesPending, datosFiscalesError, datosFiscalesSinGuardar,
    timbrarPending: timbrar.isPending || actualizarDatos.isPending,
    onConfirm,
  };
}



/** Espera también el render que adopta el autosave, no sólo la respuesta SQL. */
function camposAutosaveSinConciliar(
  patch: Partial<DatosTimbradoPatch> | undefined,
  factura: FacturaLike | null | undefined,
  formulario: Partial<DatosTimbradoPatch>,
): boolean {
  return (["uso_cfdi", "forma_pago", "metodo_pago"] as const).some((key) => patch?.[key] !== undefined
    && (factura?.[key] !== patch[key] || (formulario[key] !== undefined && formulario[key] !== patch[key])));
}

function patchAutosave(state: { variables?: unknown; data?: unknown }): Partial<DatosTimbradoPatch> | undefined {
  return (state.variables as { patch?: Partial<DatosTimbradoPatch> } | undefined)?.patch
    ?? (state.data as { patch?: Partial<DatosTimbradoPatch> } | undefined)?.patch;
}

function autosavePendiente(autosaves: readonly { status: string }[], sinConciliar: boolean): boolean {
  return autosaves.some((m) => m.status === "pending") || sinConciliar;
}
