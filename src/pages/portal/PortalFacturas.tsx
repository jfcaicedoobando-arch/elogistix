import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { usePortalFacturas, usePortalClientUsers } from "@/hooks/usePortalData";
import { formatCurrency } from "@/lib/formatters";

const estadoColor: Record<string, string> = {
  Borrador: "bg-muted text-muted-foreground",
  Emitida: "bg-info text-info-foreground",
  Pagada: "bg-success text-success-foreground",
  Vencida: "bg-destructive text-destructive-foreground",
  Cancelada: "bg-muted text-muted-foreground",
};

export default function PortalFacturas() {
  const { data: clientUsers = [] } = usePortalClientUsers();
  const clienteIds = clientUsers.map((cu) => cu.cliente_id);
  const { data: facturas = [], isLoading } = usePortalFacturas(clienteIds);

  if (isLoading) {
    return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-64 w-full" /></div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Mis Facturas</h1>
      {facturas.length === 0 ? (
        <p className="text-muted-foreground text-center py-12">No tienes facturas.</p>
      ) : (
        <div className="grid gap-3">
          {facturas.map((f) => (
            <Card key={f.id}>
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="font-medium">{f.numero}</p>
                  <p className="text-xs text-muted-foreground">
                    Expediente: {f.expediente} • Emisión: {f.fecha_emision}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Vencimiento: {f.fecha_vencimiento}
                  </p>
                </div>
                <div className="text-right space-y-1">
                  <Badge className={estadoColor[f.estado] ?? "bg-muted text-muted-foreground"}>
                    {f.estado}
                  </Badge>
                  <p className="text-sm font-medium">{formatCurrency(f.total, f.moneda)}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
