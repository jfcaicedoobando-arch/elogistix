import { Ship, FileText, Receipt, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { usePortalEmbarques, usePortalCotizaciones, usePortalFacturas, usePortalClientUsers } from "@/hooks/usePortalData";
import { getEstadoColor } from "@/lib/helpers";
import { calcularEstadoEmbarque } from "@/hooks/useEmbarques";
import { Link } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";

export default function PortalDashboard() {
  const { data: clientUsers = [] } = usePortalClientUsers();
  const clienteIds = clientUsers.map((cu) => cu.cliente_id);
  const { data: embarques = [], isLoading: loadingEmb } = usePortalEmbarques(clienteIds);
  const { data: cotizaciones = [], isLoading: loadingCot } = usePortalCotizaciones(clienteIds);
  const { data: facturas = [], isLoading: loadingFac } = usePortalFacturas(clienteIds);

  const embarquesActivos = embarques.filter(
    (e) => !["Cerrado", "Cancelado", "EIR"].includes(e.estado)
  );

  const facturasPendientes = facturas.filter(
    (f) => f.estado === "Emitida" || f.estado === "Vencida"
  );

  if (loadingEmb || loadingCot || loadingFac) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Bienvenido</h1>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Embarques Activos</CardTitle>
            <Ship className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{embarquesActivos.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Cotizaciones</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{cotizaciones.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Facturas Pendientes</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{facturasPendientes.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Recent embarques */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Embarques Recientes</CardTitle>
        </CardHeader>
        <CardContent>
          {embarquesActivos.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No hay embarques activos.</p>
          ) : (
            <div className="space-y-3">
              {embarquesActivos.slice(0, 5).map((e) => {
                const estadoVisual = calcularEstadoEmbarque(e.modo, e.tipo, e.etd, e.eta, e.estado);
                return (
                  <Link
                    key={e.id}
                    to={`/portal/embarques/${e.id}`}
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                  >
                    <div>
                      <p className="font-medium text-sm">{e.expediente}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {e.puerto_origen || e.aeropuerto_origen || e.ciudad_origen || "—"} →{" "}
                        {e.puerto_destino || e.aeropuerto_destino || e.ciudad_destino || "—"}
                      </p>
                    </div>
                    <Badge className={getEstadoColor(estadoVisual)}>{estadoVisual}</Badge>
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
