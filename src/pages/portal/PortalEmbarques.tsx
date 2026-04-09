import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { usePortalEmbarques, usePortalClientUsers } from "@/hooks/usePortalData";
import { getEstadoColor, getModoIcon } from "@/lib/helpers";
import { calcularEstadoEmbarque } from "@/hooks/useEmbarques";

export default function PortalEmbarques() {
  const { data: clientUsers = [] } = usePortalClientUsers();
  const clienteIds = clientUsers.map((cu) => cu.cliente_id);
  const { data: embarques = [], isLoading } = usePortalEmbarques(clienteIds);

  if (isLoading) {
    return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-64 w-full" /></div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Mis Embarques</h1>
      {embarques.length === 0 ? (
        <p className="text-muted-foreground text-center py-12">No tienes embarques registrados.</p>
      ) : (
        <div className="grid gap-3">
          {embarques.map((e) => {
            const estadoVisual = calcularEstadoEmbarque(e.modo, e.tipo, e.etd, e.eta, e.estado);
            return (
              <Link key={e.id} to={`/portal/embarques/${e.id}`}>
                <Card className="hover:shadow-md transition-shadow">
                  <CardContent className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                      <span className="text-lg">{getModoIcon(e.modo)}</span>
                      <div>
                        <p className="font-medium">{e.expediente}</p>
                        <p className="text-xs text-muted-foreground">
                          {e.puerto_origen || e.aeropuerto_origen || e.ciudad_origen || "—"} →{" "}
                          {e.puerto_destino || e.aeropuerto_destino || e.ciudad_destino || "—"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {e.tipo} • ETD: {e.etd || "—"} • ETA: {e.eta || "—"}
                        </p>
                      </div>
                    </div>
                    <Badge className={getEstadoColor(estadoVisual)}>{estadoVisual}</Badge>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
