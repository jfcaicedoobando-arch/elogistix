import { useParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getEstadoColor } from "@/lib/ui/uiMappings";
import { ModoIcon } from "@/components/shared/ModoIcon";
import { getOrigen, getDestino } from "@/lib/formatters";
import { Ship } from "lucide-react";
import { type TrackingPublicoData } from "@/features/embarques/services/tracking";
import { useTrackingPublicoPage } from "@/features/embarques/services/tracking/useTrackingPublicoPage";
import { TrackingPublicoErrorCard } from "@/features/embarques/components/tracking/TrackingPublicoErrorCard";
import { TrackingPublicoLoading } from "@/features/embarques/components/tracking/TrackingPublicoLoading";
import { TrackingPublicoTimeline } from "@/features/embarques/components/tracking/TrackingPublicoTimeline";
import { Seo } from "@/components/shared/Seo";

function transporteLabel(e: TrackingPublicoData["embarque"]): string {
  return e.naviera || e.aerolinea || e.transportista || "—";
}

export default function TrackingPublico() {
  const { token } = useParams<{ token: string }>();

  const { data, isLoading, error } = useTrackingPublicoPage(token);

  if (isLoading) return <TrackingPublicoLoading />;
  if (error || !data) return <TrackingPublicoErrorCard message={(error as Error)?.message} />;

  const { embarque: e, eventos, organizacion } = data;
  const orgNombre = organizacion?.nombre || "Tracking de Embarque";

  return (
    <div className="min-h-screen bg-background">
      <Seo
        title={`Seguimiento ${e.expediente} · Libre Carga`}
        description={`Consulta el estatus en tiempo real del embarque ${e.expediente} con Libre Carga.`}
        canonical={`https://librecarga.com/tracking/${token}`}
        ogTitle={`Seguimiento ${e.expediente} · Libre Carga`}
        ogDescription="Estatus en tiempo real de tu embarque con Libre Carga."
        ogUrl={`https://librecarga.com/tracking/${token}`}
      />
      <header className="border-b bg-card">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <Ship className="h-6 w-6 text-accent" />
          <div>
            <p className="font-semibold text-foreground">{orgNombre}</p>
            <p className="text-xs text-muted-foreground">Seguimiento en tiempo real</p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        <DetailHeader
          backTo={null}
          icon={<ModoIcon modo={e.modo} size={18} circle />}
          title={e.expediente}
          subtitle={`${getOrigen(e)} → ${getDestino(e)}`}
          badge={<Badge className={getEstadoColor(e.estado)}>{e.estado}</Badge>}
        />


        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Ruta</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-1">
              <p><strong>Origen:</strong> {getOrigen(e)}</p>
              <p><strong>Destino:</strong> {getDestino(e)}</p>
              <p><strong>ETD:</strong> {e.etd || "—"}</p>
              <p><strong>ETA:</strong> {e.eta || "—"}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Detalles</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-1">
              <p><strong>Modo:</strong> {e.modo}</p>
              <p><strong>Tipo:</strong> {e.tipo}</p>
              <p><strong>Transporte:</strong> {transporteLabel(e)}</p>
            </CardContent>
          </Card>
        </div>

        <TrackingPublicoTimeline eventos={eventos} />
      </main>

      <footer className="border-t bg-card mt-12">
        <div className="max-w-3xl mx-auto px-4 py-4 text-center text-xs text-muted-foreground">
          Powered by {organizacion?.nombre || "Libre Carga"}
        </div>
      </footer>
    </div>
  );
}
