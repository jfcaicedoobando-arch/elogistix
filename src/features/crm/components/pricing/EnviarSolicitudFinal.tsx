/** Envío final a Pricing, tras revisar que el tarifario no tiene opción útil. */
import { Send } from "lucide-react";
import { useLayoutEffect, useRef, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAccionSolicitud } from "@/features/crm/hooks/usePricingCrm";
import { camposFaltantesSolicitud } from "@/features/crm/services/pricing/camposObligatorios";
import { actualizarSolicitud } from "@/features/crm/services/pricing/pricingCrm";
import { useOpcionesTarifario } from "@/features/crm/hooks/useOpcionesTarifario";
import { mensajeErrorPricing } from "@/features/crm/services/pricing/tiposPricing";
import { notifyError } from "@/lib/ui/appFeedback";
import type { SolicitudPricingRow } from "@/features/crm/services/pricing/tiposPricing";
import { getSessionCacheGeneration, subscribeSessionCacheGeneration } from "@/lib/auth/sessionCacheRegistry";

export function EnviarSolicitudFinal({ solicitud: s, puede }: { solicitud: SolicitudPricingRow; puede: boolean }) {
  const generation = useSyncExternalStore(subscribeSessionCacheGeneration, getSessionCacheGeneration, getSessionCacheGeneration);
  if (s.estado !== "borrador" || !puede) return null;
  return <SesionEnvio key={JSON.stringify([s.id, s.organization_id, s.oportunidad_id, generation])} solicitud={s} />;
}

function SesionEnvio({ solicitud: s }: { solicitud: SolicitudPricingRow }) {
  const accion = useAccionSolicitud();
  const { opciones, isLoading } = useOpcionesTarifario(s);
  const faltan = camposFaltantesSolicitud(s);
  const montada = useRef(false);
  const enCurso = useRef(false);
  useLayoutEffect(() => {
    montada.current = true;
    return () => { montada.current = false; };
  }, []);
  const enviar = async () => {
    if (enCurso.current || !montada.current || faltan.length > 0) return;
    enCurso.current = true;
    // Con coincidencias vigentes se piden más opciones; sin ellas es una ruta nueva.
    try {
      await actualizarSolicitud(s.id, { tipo_solicitud: opciones.length > 0 ? "nuevas_tarifas" : "nueva_ruta" });
    } catch (e) {
      enCurso.current = false;
      notifyError(undefined, { title: "No se pudo enviar a Pricing", description: mensajeErrorPricing(e), error: e, method: "CRM_PRICING_TIPO" });
      return;
    }
    if (!montada.current) { enCurso.current = false; return; }
    accion.mutate({ id: s.id, oportunidadId: s.oportunidad_id, accion: "enviar", vigente: () => montada.current }, {
      onSettled: () => { enCurso.current = false; },
    });
  };
  return (
    <Card>
      <CardContent className="flex flex-wrap items-center gap-3 py-4">
        <p className="text-body-sm text-muted-foreground">
          {faltan.length > 0 ? `Para enviar, completa: ${faltan.join(", ")}.`
            : opciones.length > 0 ? "Las opciones del tarifario no bastan; pediré más a Pricing."
              : "No hay tarifas que coincidan; Pricing buscará una ruta nueva."}
        </p>
        <Button size="sm" className="ml-auto" disabled={accion.isPending || isLoading || faltan.length > 0}
          onClick={() => { void enviar(); }}>
          <Send className="mr-1 size-4" /> Enviar a Pricing
        </Button>
      </CardContent>
    </Card>
  );
}
