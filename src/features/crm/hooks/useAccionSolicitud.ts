import { useMutation, useQueryClient, type MutateOptions } from "@tanstack/react-query";
import { AuthOperationChangedError, captureAuthOperationScope } from "@/lib/auth/authOperationScope";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";
import { crmPricingKeys } from "@/features/crm/queryKeys.performance";
import { cancelarSolicitud, enviarSolicitud, responderSolicitud } from "@/features/crm/services/pricing/pricingCrm";
import { mensajeErrorPricing } from "@/features/crm/services/pricing/tiposPricing";
import { useInvalidarSolicitud } from "./useInvalidarSolicitud";

type AccionSolicitudInput = { id: string; oportunidadId: string | null; accion: "enviar" | "responder" | "cancelar"; vigente?: () => boolean };
type AccionSolicitudScope = AccionSolicitudInput & { scope: ReturnType<typeof captureAuthOperationScope> };

export function useAccionSolicitud() {
  const qc = useQueryClient();
  const invalidar = useInvalidarSolicitud();
  const esVigente = (v: AccionSolicitudScope) => v.scope.isCurrent() && (v.vigente?.() ?? true)
    && qc.getMutationCache().getAll().some((m) => m.state.variables === v);
  const mutation = useMutation<void, Error, AccionSolicitudScope>({
    // Un fallo de transporte no confirma que el servidor rechazara la transición.
    retry: false,
    mutationFn: async (v) => {
      const assertCurrent = () => { if (!esVigente(v)) throw new AuthOperationChangedError(); };
      assertCurrent();
      try {
        if (v.accion === "enviar") await enviarSolicitud(v.id);
        else if (v.accion === "responder") await responderSolicitud(v.id);
        else await cancelarSolicitud(v.id);
      } catch (error) {
        assertCurrent();
        throw error;
      }
      assertCurrent();
    },
    onSuccess: (_d, v) => {
      const vigente = () => esVigente(v);
      if (!vigente()) return;
      void invalidar(v.id, v.oportunidadId, vigente);
      if (vigente()) void qc.invalidateQueries({ queryKey: crmPricingKeys.opciones(v.id), exact: true });
      // Traer la respuesta final antes de detener el polling al cambiar de estado.
      if (vigente()) void qc.invalidateQueries({ queryKey: crmPricingKeys.tarifasRespuesta(v.id), exact: true });
      if (!vigente()) return;
      const t = { enviar: "Solicitud enviada", responder: "Respuesta enviada al solicitante", cancelar: "Solicitud cancelada" };
      notifySuccess(undefined, { title: t[v.accion] });
    },
    onError: (error, v) => {
      if (!esVigente(v) || error instanceof AuthOperationChangedError) return;
      const { scope: _scope, vigente: _vigente, ...variables } = v;
      notifyError(undefined, { title: "No se pudo actualizar la solicitud de Pricing",
        description: mensajeErrorPricing(error), error, method: "CRM_PRICING_MUTACION", context: { variables } });
    },
  });
  const preparar = (input: AccionSolicitudInput): AccionSolicitudScope => ({ ...input, scope: captureAuthOperationScope() });
  const proteger = (options?: MutateOptions<void, Error, AccionSolicitudInput>): MutateOptions<void, Error, AccionSolicitudScope> | undefined => options && ({
    onSuccess: (data, v, context, mutationContext) => {
      if (esVigente(v)) options.onSuccess?.(data, v, context, mutationContext);
    },
    onError: (error, v, context, mutationContext) => {
      if (esVigente(v) && !(error instanceof AuthOperationChangedError)) options.onError?.(error, v, context, mutationContext);
    },
    onSettled: (data, error, v, context, mutationContext) => {
      if (esVigente(v) && !(error instanceof AuthOperationChangedError)) options.onSettled?.(data, error, v, context, mutationContext);
    },
  });
  return { ...mutation,
    mutate: (input: AccionSolicitudInput, options?: MutateOptions<void, Error, AccionSolicitudInput>) => mutation.mutate(preparar(input), proteger(options)),
    mutateAsync: (input: AccionSolicitudInput, options?: MutateOptions<void, Error, AccionSolicitudInput>) => mutation.mutateAsync(preparar(input), proteger(options)),
  };
}
