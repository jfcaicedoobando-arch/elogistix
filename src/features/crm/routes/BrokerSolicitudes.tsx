/** CRM · Solicitudes de brokers: autorizar o rechazar peticiones de prospectos. */
import { useState } from "react";
import { Check, Handshake, X } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { CargaGuard } from "@/components/shared/states/CargaGuard";
import { ReasonDialog } from "@/components/shared/ReasonDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useDocumentTitle } from "@/hooks/shared";
import { formatDate } from "@/lib/formatters/dates";
import { useBrokerSolicitudes, useResolverSolicitudBroker } from "../hooks/useBrokerSolicitudes";

export default function BrokerSolicitudes() {
  useDocumentTitle("Solicitudes de brokers");
  const q = useBrokerSolicitudes();
  const m = useResolverSolicitudBroker();
  const [rechazar, setRechazar] = useState<string | null>(null);
  const filas = q.data ?? [];

  return (
    <div className="space-y-4">
      <PageHeader
        icon={<Handshake className="h-6 w-6 text-primary" />}
        title="Solicitudes de brokers"
        description="Brokers que piden trabajar prospectos existentes."
      />
      <CargaGuard isLoading={q.isLoading} isError={q.isError} onRetry={q.refetch}
        errorTitle="No se pudieron cargar las solicitudes" errorDescription="Revisa tu conexión y vuelve a intentar.">
        {filas.length === 0 ? (
          <p className="text-body-sm text-muted-foreground">No hay solicitudes pendientes.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {filas.map((s) => (
              <Card key={s.id}>
                <CardContent className="p-4 space-y-2 text-body-sm">
                  <p className="font-medium">{s.empresa}</p>
                  <p className="text-muted-foreground">{s.broker} · {formatDate(s.created_at)}</p>
                  <p><span className="text-muted-foreground">Conoce a:</span> {s.rol_contacto}</p>
                  <p><span className="text-muted-foreground">Relación:</span> {s.relacion}</p>
                  <p><span className="text-muted-foreground">Cierre estimado:</span> {s.tiempo_cierre}</p>
                  <div className="flex gap-2 pt-1">
                    <Button size="sm" onClick={() => m.mutate({ id: s.id, autorizar: true })} disabled={m.isPending}>
                      <Check className="h-4 w-4" /> Autorizar
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setRechazar(s.id)} disabled={m.isPending}>
                      <X className="h-4 w-4" /> Rechazar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CargaGuard>
      <ReasonDialog
        open={!!rechazar}
        onOpenChange={(o) => { if (!o) setRechazar(null); }}
        title="Rechazar solicitud"
        description="El broker verá este motivo."
        confirmLabel="Rechazar"
        pending={m.isPending}
        onConfirm={async (motivo) => {
          if (!rechazar) return;
          await m.mutateAsync({ id: rechazar, autorizar: false, motivo });
          setRechazar(null);
        }}
      />
    </div>
  );
}
