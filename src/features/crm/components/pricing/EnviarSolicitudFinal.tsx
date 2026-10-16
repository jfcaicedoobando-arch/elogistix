/** Envío final a Pricing, tras revisar que el tarifario no tiene opción útil. */
import { Send } from "lucide-react";
import { useLayoutEffect, useRef, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAccionSolicitud } from "@/features/crm/hooks/usePricingCrm";
import type { SolicitudPricingRow } from "@/features/crm/services/pricing/tiposPricing";
import { getSessionCacheGeneration, subscribeSessionCacheGeneration } from "@/lib/auth/sessionCacheRegistry";

export function EnviarSolicitudFinal({ solicitud: s, puede }: { solicitud: SolicitudPricingRow; puede: boolean }) {
  const generation = useSyncExternalStore(subscribeSessionCacheGeneration, getSessionCacheGeneration, getSessionCacheGeneration);
  if (s.estado !== "borrador" || !puede) return null;
  return <SesionEnvio key={JSON.stringify([s.id, s.organization_id, s.oportunidad_id, generation])} solicitud={s} />;
}

function SesionEnvio({ solicitud: s }: { solicitud: SolicitudPricingRow }) {
  const accion = useAccionSolicitud();
  const montada = useRef(false);
  const enCurso = useRef(false);
  useLayoutEffect(() => {
    montada.current = true;
    return () => { montada.current = false; };
  }, []);
  const enviar = () => {
    if (enCurso.current || !montada.current) return;
    enCurso.current = true;
    accion.mutate({ id: s.id, oportunidadId: s.oportunidad_id, accion: "enviar", vigente: () => montada.current }, {
      onSettled: () => { enCurso.current = false; },
    });
  };
  return (
    <Card>
      <CardContent className="flex flex-wrap items-center gap-3 py-4">
        <p className="text-body-sm text-muted-foreground">Revisé el tarifario y ninguna opción me sirve.</p>
        <Button size="sm" className="ml-auto" disabled={accion.isPending}
          onClick={enviar}>
          <Send className="mr-1 size-4" /> Enviar a Pricing
        </Button>
      </CardContent>
    </Card>
  );
}
