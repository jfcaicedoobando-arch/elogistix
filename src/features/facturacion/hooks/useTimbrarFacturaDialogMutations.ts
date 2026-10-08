import type { TimbradoScope } from "./useTimbradoScope";
/** Mutaciones del diálogo: guardar datos, preferencias y correo del CFDI confirmado. */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { actualizarDatosTimbradoFactura, guardarDefaultsTimbradoCliente, type ClienteFiscalRow } from "@/features/facturacion/services";
import { enviarCfdiFactura } from "@/features/facturacion/services/enviarCfdiEmail";
import { useToast } from "@/hooks/shared";
import { getErrorMessage } from "@/lib/errors/index";
import { notifyError } from "@/lib/ui/appFeedback";
import { queryKeys } from "@/lib/query";
import { logger } from "@/lib/observability/logger";

interface ActualizarDatosVars {
  scope: TimbradoScope;
  facturaId: string;
  uso_cfdi: string;
  forma_pago: string;
  metodo_pago: string;
}

interface GuardarDefaultsVars {
  scope: TimbradoScope;
  clienteId: string;
  uso_cfdi_default?: string;
  forma_pago_default: string;
  metodo_pago_default: string;
}

export function useTimbrarFacturaDialogMutations() {
  const qc = useQueryClient();
  const { toast } = useToast();
  // Mutación 1 — persiste los datos fiscales elegidos antes del timbrado.
  const actualizarDatos = useMutation({
    mutationKey: queryKeys.facturacion.actualizarDatosTimbrado,
    mutationFn: (v: ActualizarDatosVars) =>
      actualizarDatosTimbradoFactura(v.facturaId, {
        uso_cfdi: v.uso_cfdi, forma_pago: v.forma_pago, metodo_pago: v.metodo_pago,
      }, undefined, { ...v.scope, borrador: true }),
    onError: (err, vars) => {
      if (!vars.scope.authScope.isCurrent()) return;
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
      }, v.scope),
    onSuccess: (_r, v) => {
      if (!v.scope.authScope.isCurrent()) return;
      // La preferencia explícita precede al RPC: ambas cachés deben reflejar la escritura.
      const fiscalKey = queryKeys.facturacion.clienteFiscal(v.clienteId);
      qc.setQueryData<ClienteFiscalRow | null>(fiscalKey, (cached) =>
        cached && v.uso_cfdi_default ? { ...cached, uso_cfdi_default: v.uso_cfdi_default } : cached);
      qc.invalidateQueries({ queryKey: fiscalKey });
      qc.invalidateQueries({ queryKey: queryKeys.facturacion.clienteDefaults(v.clienteId) });
    },
    onError: (err, v) => {
      if (!v.scope.authScope.isCurrent()) return;
      // best-effort: sólo warning, no rompe el timbrado ya exitoso.
      logger.warn("timbrado", "no se guardaron los defaults del cliente:", err);
    },
  });

  // Mutación 3 — envío del CFDI por email tras timbrado exitoso.
  const enviarCfdi = useMutation({
    mutationKey: queryKeys.facturacion.enviarCfdiEmail,
    mutationFn: (v: { facturaId: string; email: string; scope: TimbradoScope }) => {
      v.scope.authScope.assertCurrent();
      return enviarCfdiFactura(v.facturaId, v.email);
    },
    onSuccess: (r, v) => {
      if (!v.scope.authScope.isCurrent()) return;
      toast({ title: "CFDI enviado", description: `Enviado a ${r.enviado_a}.` });
    },
    onError: (err, vars) => {
      if (!vars.scope.authScope.isCurrent()) return;
      notifyError(undefined, {
        title: "Factura timbrada, pero no se envió el email",
        description: getErrorMessage(err),
        error: err,
        method: "FACTURACION_ENVIAR_EMAIL_TRAS_TIMBRADO",
        context: { facturaId: vars.facturaId },
      });
    },
  });

  return { actualizarDatos, guardarDefaults, enviarCfdi };
}
