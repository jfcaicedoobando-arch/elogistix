import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { usePortalCotizaciones, usePortalClientUsers } from "@/hooks/usePortalData";
import { formatCurrency } from "@/lib/formatters";

const estadoColor: Record<string, string> = {
  Borrador: "bg-muted text-muted-foreground",
  Enviada: "bg-info text-info-foreground",
  Confirmada: "bg-success text-success-foreground",
  Aceptada: "bg-success text-success-foreground",
  Rechazada: "bg-destructive text-destructive-foreground",
  Vencida: "bg-warning text-warning-foreground",
  Embarcada: "bg-primary text-primary-foreground",
};

export default function PortalCotizaciones() {
  const { data: clientUsers = [] } = usePortalClientUsers();
  const clienteIds = clientUsers.map((cu) => cu.cliente_id);
  const { data: cotizaciones = [], isLoading } = usePortalCotizaciones(clienteIds);

  if (isLoading) {
    return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-64 w-full" /></div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Mis Cotizaciones</h1>
      {cotizaciones.length === 0 ? (
        <p className="text-muted-foreground text-center py-12">No tienes cotizaciones.</p>
      ) : (
        <div className="grid gap-3">
          {cotizaciones.map((c) => (
            <Card key={c.id}>
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="font-medium">{c.folio}</p>
                  <p className="text-xs text-muted-foreground">
                    {c.modo} • {c.tipo} • {c.origen || "—"} → {c.destino || "—"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Vigencia: {c.fecha_vigencia || "—"}
                  </p>
                </div>
                <div className="text-right space-y-1">
                  <Badge className={estadoColor[c.estado] ?? "bg-muted text-muted-foreground"}>
                    {c.estado}
                  </Badge>
                  <p className="text-sm font-medium">{formatCurrency(c.subtotal, c.moneda)}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
