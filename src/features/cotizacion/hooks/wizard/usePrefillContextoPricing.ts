import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { UseFormReturn } from "react-hook-form";
import type { CotizacionFormValues } from "@/features/cotizacion/types";
import { cotizaciones } from "@/features/cotizacion/queryKeys";
import { fetchContextoPricingCotizacion } from "@/features/cotizacion/services/contextoPricingCotizacion";
import { recordarIdentidadPricing } from "./identidadPricing";
import { aplicarRespuestaPricing } from "@/features/cotizacion/hooks/wizard/aplicarRespuestaPricing";
import { aplicarDestinatarioPricing } from "@/features/cotizacion/hooks/wizard/aplicarDestinatarioPricing";
import { validarIncotermRespuestaPricing } from "@/features/cotizacion/domain/respuestaPricing";
import { usePricingScope } from "./usePricingScope";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";

interface Deps {
  form: UseFormReturn<CotizacionFormValues>;
  tarifaId: string | null;
  oportunidadId: string | null;
  solicitudId: string | null;
  organizationId: string | null | undefined;
  enabled: boolean;
}
type Estado = "inactivo" | "cargando" | "aplicado" | "error" | "captura-conservada";

function tieneCaptura(form: UseFormReturn<CotizacionFormValues>) {
  const v = form.getValues();
  return form.formState.isDirty || Boolean(v.clienteId || v.oportunidadId || v.leadId || v.tarifaId);
}

export function usePrefillContextoPricing({ form, tarifaId, oportunidadId, solicitudId, organizationId, enabled }: Deps) {
  const scope = usePricingScope();
  const clave = JSON.stringify([organizationId, scope.userId, scope.generation, oportunidadId, solicitudId, tarifaId]);
  const terminado = useRef<string | null>(null);
  const [estado, setEstado] = useState<Estado>("inactivo");
  const { isDirty } = form.formState;
  const activo = enabled && Boolean(tarifaId && organizationId && scope.userId && scope.organizationId === organizationId);
  const query = useQuery({
    queryKey: cotizaciones.contextoPricing(scope, oportunidadId, solicitudId, tarifaId),
    queryFn: () => fetchContextoPricingCotizacion({ organizationId: organizationId ?? "", tarifaId: tarifaId ?? "", oportunidadId, solicitudId }),
    enabled: activo,
    retry: false,
    staleTime: 0,
    refetchOnMount: "always",
  });

  useEffect(() => {
    if (!activo || !scope.isCurrent() || terminado.current === clave) return;
    if (tieneCaptura(form)) {
      terminado.current = clave;
      setEstado("captura-conservada");
      return;
    }
    if (query.isPending || query.isFetching) { setEstado("cargando"); return; }
    terminado.current = clave;
    if (query.isError || !query.data) {
      setEstado("error");
      notifyError(undefined, { title: "No se pudo aplicar la respuesta de Pricing", error: query.error, method: "COTIZACION_CONTEXTO_PRICING" });
      return;
    }
    const { destinatario, tarifa, solicitud } = query.data;
    try {
      validarIncotermRespuestaPricing(solicitud);
    } catch (error) {
      setEstado("error");
      notifyError(undefined, { title: "No se pudo aplicar la respuesta de Pricing", error, method: "COTIZACION_CONTEXTO_PRICING" });
      return;
    }
    if (destinatario) aplicarDestinatarioPricing(form, destinatario);
    aplicarRespuestaPricing(form, tarifa, solicitud);
    recordarIdentidadPricing(form, solicitud ? solicitudId : null, organizationId ?? "");
    setEstado("aplicado");
    if (!solicitud) notifySuccess(undefined, { title: "Tarifa aplicada. Revisa Incoterm y cantidad: el enlace no identifica una solicitud." });
  }, [activo, clave, form, isDirty, query.isPending, query.isFetching, scope, query.isError, query.error, query.data, solicitudId, organizationId]);
  return { estado: activo ? estado : "inactivo", isLoading: activo && (query.isPending || query.isFetching) && terminado.current !== clave };
}
