import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getEstadoColor, getModoIcon } from "@/lib/uiMappings";
import { formatDate, getOrigen, getDestino } from "@/lib/formatters";
import { ICONO_EVENTO } from "@/data/embarqueConstants";
import { Clock, MapPin, Ship, AlertTriangle } from "lucide-react";

interface TrackingData {
  embarque: {
    expediente: string;
    cliente_nombre: string;
    modo: string;
    tipo: string;
    estado: string;
    etd: string | null;
    eta: string | null;
    puerto_origen: string | null;
    puerto_destino: string | null;
    aeropuerto_origen: string | null;
    aeropuerto_destino: string | null;
    ciudad_origen: string | null;
    ciudad_destino: string | null;
    naviera: string | null;
    aerolinea: string | null;
    transportista: string | null;
  };
  eventos: { tipo: string; descripcion: string; ubicacion: string; fecha: string }[];
  organizacion: { nombre: string; logo_url: string | null } | null;
}

export default function TrackingPublico() {
  const { token } = useParams<{ token: string }>();

  const { data, isLoading, error } = useQuery<TrackingData>({
    queryKey: ["tracking-public", token],
    queryFn: async () => {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const url = `https://${projectId}.supabase.co/functions/v1/tracking-public?token=${token}`;
      const res = await fetch(url);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Error al cargar tracking");
      }
      return res.json();
    },
    enabled: !!token,
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="space-y-4 w-full max-w-2xl px-4">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="flex flex-col items-center py-12">
            <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
            <h2 className="text-lg font-semibold mb-2">Enlace no disponible</h2>
            <p className="text-sm text-muted-foreground text-center">
              {(error as Error)?.message || "Este enlace de tracking no existe o ha expirado."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { embarque: e, eventos, organizacion } = data;
  const origen = getOrigen(e);
  const destino = getDestino(e);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <Ship className="h-6 w-6 text-accent" />
          <div>
            <p className="font-semibold text-foreground">
              {organizacion?.nombre || "Tracking de Embarque"}
            </p>
            <p className="text-xs text-muted-foreground">Seguimiento en tiempo real</p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Embarque info */}
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-bold">{e.expediente}</h1>
          <Badge className={getEstadoColor(e.estado)}>{e.estado}</Badge>
          <span className="text-lg">{getModoIcon(e.modo)}</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Ruta</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-1">
              <p><strong>Origen:</strong> {origen}</p>
              <p><strong>Destino:</strong> {destino}</p>
              <p><strong>ETD:</strong> {e.etd || "—"}</p>
              <p><strong>ETA:</strong> {e.eta || "—"}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Detalles</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-1">
              <p><strong>Modo:</strong> {e.modo}</p>
              <p><strong>Tipo:</strong> {e.tipo}</p>
              <p><strong>Transporte:</strong> {e.naviera || e.aerolinea || e.transportista || "—"}</p>
            </CardContent>
          </Card>
        </div>

        {/* Timeline */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm">Línea de Tiempo</CardTitle></CardHeader>
          <CardContent>
            {eventos.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No hay eventos registrados aún.</p>
            ) : (
              <div className="relative">
                <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />
                <div className="space-y-6">
                  {eventos.map((ev, i) => (
                    <div key={i} className="relative pl-10">
                      <div className={`absolute left-2.5 top-1 h-3.5 w-3.5 rounded-full border-2 border-background ${i === 0 ? "bg-accent" : "bg-muted-foreground/40"}`} />
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-base">{ICONO_EVENTO[ev.tipo] ?? "📝"}</span>
                          <Badge variant="secondary" className="text-xs">{ev.tipo}</Badge>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDate(ev.fecha, "dd MMM yyyy, HH:mm")}
                          </span>
                        </div>
                        {ev.descripcion && <p className="text-sm text-foreground">{ev.descripcion}</p>}
                        {ev.ubicacion && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <MapPin className="h-3 w-3" /> {ev.ubicacion}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      <footer className="border-t bg-card mt-12">
        <div className="max-w-3xl mx-auto px-4 py-4 text-center text-xs text-muted-foreground">
          Powered by {organizacion?.nombre || "Libre Carga"}
        </div>
      </footer>
    </div>
  );
}
