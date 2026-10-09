import { crmPricingKeys } from "@/features/crm/queryKeys.performance";
/**
 * Hooks de la Solicitud a Pricing (CRM Fase 5). Llaves bajo ['crm','pricing'].
 */
import { keepPreviousData, useMutation, useQuery, useQueryClient, type MutateOptions } from "@tanstack/react-query";
import { AuthOperationChangedError, captureAuthOperationScope } from "@/lib/auth/authOperationScope";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";
import { listarTarifasParaPricing } from "@/features/crm/services/pricing/tarifasParaPricing";
import {
  actualizarSolicitud, cancelarSolicitud, crearSolicitud, eliminarOpcion, enviarSolicitud,
  guardarOpcion, listarBandejaPricing, listarOpciones, listarSolicitudesOportunidad,
  listarUsuariosOrg, obtenerSolicitud, responderSolicitud,
} from "@/features/crm/services/pricing/pricingCrm";
import { mensajeErrorPricing, type SolicitudPricingInsert, type SolicitudPricingRow } from "@/features/crm/services/pricing/tiposPricing";

/** La escritura terminó; sólo falta confirmar el envío de esta misma solicitud. */
export class ErrorEnvioSolicitudPricing extends Error {
  constructor(readonly solicitudId: string, readonly errorEnvio: unknown) {
    super(errorEnvio instanceof Error ? errorEnvio.message : mensajeErrorPricing(errorEnvio));
    this.name = "ErrorEnvioSolicitudPricing";
  }
}

function useInvalidarSolicitud() {
  const qc = useQueryClient();
  return (id: string, oportunidadId: string | null | undefined, vigente = () => true) => Promise.all([
    { queryKey: crmPricingKeys.solicitud(id), exact: true },
    // Un cambio de estado mueve filas entre filtros/páginas de la bandeja.
    { queryKey: crmPricingKeys.bandejas },
    ...(oportunidadId ? [{ queryKey: crmPricingKeys.oportunidad(oportunidadId), exact: true }] : []),
  ].map((options) => vigente() ? qc.invalidateQueries(options) : undefined));
}
const onError = (error: unknown, variables: unknown) => notifyError(undefined, { title: "No se pudo actualizar la solicitud de Pricing",
  description: mensajeErrorPricing(error), error, method: "CRM_PRICING_MUTACION", context: { variables } });

export function useTarifasPricing(enabled: boolean) {
  return useQuery({ queryKey: crmPricingKeys.tarifas, queryFn: listarTarifasParaPricing, enabled });
}

export function useSolicitudesOportunidad(oportunidadId: string) {
  return useQuery({
    queryKey: crmPricingKeys.oportunidad(oportunidadId),
    queryFn: () => listarSolicitudesOportunidad(oportunidadId),
    // Mientras haya solicitudes enviadas sin respuesta, reconsulta solo (30 s)
    // para que el solicitante vea la respuesta de Pricing sin recargar.
    refetchInterval: (q) =>
      (q.state.data ?? []).some((s) => s.estado === "enviada") ? 30_000 : false,
  });
}

export function useBandejaPricing(estado: string, pagina: number) {
  return useQuery({
    queryKey: crmPricingKeys.bandeja(estado, pagina),
    queryFn: () => listarBandejaPricing(estado, pagina),
    placeholderData: keepPreviousData,
  });
}

export function useSolicitudPricing(id: string | null) {
  return useQuery({
    queryKey: crmPricingKeys.solicitud(id),
    queryFn: () => obtenerSolicitud(id as string),
    enabled: !!id,
  });
}

export function useOpcionesPricing(solicitudId: string | null) {
  return useQuery({
    queryKey: crmPricingKeys.opciones(solicitudId),
    queryFn: () => listarOpciones(solicitudId as string),
    enabled: !!solicitudId,
  });
}

export function useUsuariosOrgCrm() {
  return useQuery({ queryKey: crmPricingKeys.usuarios, queryFn: listarUsuariosOrg, staleTime: 5 * 60_000 });
}

/** Guarda (alta o edición) y, si `enviar`, la manda a Pricing en el mismo flujo. */
type GuardarSolicitudInput = { id?: string; datos: SolicitudPricingInsert; enviar: boolean; vigente?: () => boolean };
type GuardarSolicitudScope = GuardarSolicitudInput & { scope: ReturnType<typeof captureAuthOperationScope> };

export function useGuardarSolicitud() {
  const qc = useQueryClient();
  const invalidar = useInvalidarSolicitud();
  const esVigente = (variables: GuardarSolicitudScope) => variables.scope.isCurrent()
    && (variables.vigente?.() ?? true)
    // clear() retira la mutación: su respuesta no puede reconstruir la caché limpiada.
    && qc.getMutationCache().getAll().some((m) => m.state.variables === variables);
  const mutation = useMutation<string, Error, GuardarSolicitudScope>({
    // El flujo tiene dos escrituras: repetirlo automáticamente podría duplicar el alta.
    retry: false,
    mutationFn: async (variables) => {
      const { scope: _scope, ...input } = variables;
      const vigente = () => esVigente(variables);
      const assertCurrent = () => { if (!vigente()) throw new AuthOperationChangedError(); };
      assertCurrent();
      let id = input.id;
      try {
        if (id) await actualizarSolicitud(id, input.datos);
        else {
          const creada = await crearSolicitud(input.datos);
          id = creada.id;
          assertCurrent();
          qc.setQueryData(crmPricingKeys.solicitud(id), creada);
          if (input.datos.oportunidad_id) {
            assertCurrent();
            qc.setQueryData<SolicitudPricingRow[]>(crmPricingKeys.oportunidad(input.datos.oportunidad_id),
              (filas) => filas ? [creada, ...filas.filter((s) => s.id !== creada.id)] : undefined);
          }
        }
      } catch (error) {
        assertCurrent();
        throw error;
      }
      assertCurrent();
      try {
        if (input.enviar) await enviarSolicitud(id);
        assertCurrent();
      } catch (error) {
        assertCurrent();
        throw new ErrorEnvioSolicitudPricing(id, error);
      } finally {
        // La edición/alta ya se guardó, incluso si el envío posterior falla.
        // No esperar lecturas: el callback del formulario aún debe subir adjuntos.
        if (vigente()) void invalidar(id, input.datos.oportunidad_id, vigente);
      }
      assertCurrent();
      return id;
    },
    onSuccess: (_id, v) => {
      if (esVigente(v))
        notifySuccess(undefined, { title: v.enviar ? "Solicitud enviada a Pricing" : "Borrador guardado" });
    },
    onError: (error, v) => {
      if (!esVigente(v) || error instanceof AuthOperationChangedError) return;
      const { scope: _scope, ...variables } = v;
      if (error instanceof ErrorEnvioSolicitudPricing) {
        notifyError(undefined, { title: "Solicitud guardada; envío sin confirmar",
          description: mensajeErrorPricing(error.errorEnvio), error: error.errorEnvio,
          method: "CRM_PRICING_ENVIO", context: { solicitudId: error.solicitudId } });
      } else onError(error, variables);
    },
  });
  const preparar = (input: GuardarSolicitudInput): GuardarSolicitudScope => ({ ...input, scope: captureAuthOperationScope() });
  const proteger = (options?: MutateOptions<string, Error, GuardarSolicitudInput>): MutateOptions<string, Error, GuardarSolicitudScope> | undefined => options && ({
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
    mutate: (input: GuardarSolicitudInput, options?: MutateOptions<string, Error, GuardarSolicitudInput>) => mutation.mutate(preparar(input), proteger(options)),
    mutateAsync: (input: GuardarSolicitudInput, options?: MutateOptions<string, Error, GuardarSolicitudInput>) => mutation.mutateAsync(preparar(input), proteger(options)),
  };
}

export function useAccionSolicitud() {
  const qc = useQueryClient();
  const invalidar = useInvalidarSolicitud();
  return useMutation({
    mutationFn: ({ id, accion }: { id: string; oportunidadId: string | null; accion: "enviar" | "responder" | "cancelar" }) =>
      accion === "enviar" ? enviarSolicitud(id) : accion === "responder" ? responderSolicitud(id) : cancelarSolicitud(id),
    onSuccess: (_d, v) => {
      const t = { enviar: "Solicitud enviada", responder: "Respuesta enviada al solicitante", cancelar: "Solicitud cancelada" };
      notifySuccess(undefined, { title: t[v.accion] });
      void Promise.all([
        invalidar(v.id, v.oportunidadId),
        qc.invalidateQueries({ queryKey: crmPricingKeys.opciones(v.id), exact: true }),
        // Traer la respuesta final antes de detener el polling al cambiar de estado.
        qc.invalidateQueries({ queryKey: crmPricingKeys.tarifasRespuesta(v.id), exact: true }),
      ]);
    },
    onError: onError,
  });
}

export function useGuardarOpcion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: guardarOpcion,
    onSuccess: (_data, { solicitudId }) => {
      notifySuccess(undefined, { title: "Opción guardada" });
      void qc.invalidateQueries({ queryKey: crmPricingKeys.opciones(solicitudId), exact: true });
    },
    onError: onError,
  });
}

export function useEliminarOpcion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string; solicitudId: string }) => eliminarOpcion(id),
    onSuccess: (_data, { solicitudId }) => {
      void qc.invalidateQueries({ queryKey: crmPricingKeys.opciones(solicitudId), exact: true });
    },
    onError: onError,
  });
}
