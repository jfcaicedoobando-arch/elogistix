/** Envío final a Pricing, tras revisar que el tarifario no tiene opción útil. */
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAccionSolicitud } from "@/features/crm/hooks/usePricingCrm";
import type { SolicitudPricingRow } from "@/features/crm/services/pricing/tiposPricing";

export function EnviarSolicitudFinal({ solicitud: s }: { solicitud: SolicitudPricingRow }) {
  const accion = useAccionSolicitud();
  return (
    <Card>
      <CardContent className="flex flex-wrap items-center gap-3 py-4">
        <p className="text-body-sm text-muted-foreground">Revisé el tarifario y ninguna opción me sirve.</p>
        <Button size="sm" className="ml-auto" disabled={accion.isPending}
          onClick={() => accion.mutate({ id: s.id, oportunidadId: s.oportunidad_id, accion: "enviar" })}>
          <Send className="mr-1 size-4" /> Enviar a Pricing
        </Button>
      </CardContent>
    </Card>
  );
}
