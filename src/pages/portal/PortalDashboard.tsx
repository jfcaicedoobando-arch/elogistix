import { Ship, FileText, Receipt, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { usePortalEmbarques, usePortalCotizaciones, usePortalFacturas, usePortalClientUsers, usePortalClienteName, usePortalOrgName } from "@/hooks/usePortalData";
import { getEstadoColor } from "@/lib/helpers";
import { calcularEstadoEmbarque } from "@/hooks/useEmbarques";
import { Link } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";

const kpis = [
  { key: "embarques", label: "Embarques Activos", icon: Ship, iconBg: "bg-blue-100", iconColor: "text-blue-600" },
  { key: "cotizaciones", label: "Cotizaciones", icon: FileText, iconBg: "bg-violet-100", iconColor: "text-violet-600" },
  { key: "facturas", label: "Facturas Pendientes", icon: Receipt, iconBg: "bg-amber-100", iconColor: "text-amber-600" },
] as const;

export default function PortalDashboard() {
  const { data: clientUsers = [] } = usePortalClientUsers();
  const { data: clienteName } = usePortalClienteName();
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

  const kpiValues = {
    embarques: embarquesActivos.length,
    cotizaciones: cotizaciones.length,
    facturas: facturasPendientes.length,
  };

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
      <div>
        <h1 className="text-2xl font-bold">
          {clienteName ? `Bienvenido, ${clienteName}` : "Bienvenido"}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Aquí puedes consultar el estado de tus embarques, cotizaciones y facturas.
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {kpis.map((kpi) => (
          <Card key={kpi.key}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{kpi.label}</CardTitle>
              <div className={`rounded-full p-2 ${kpi.iconBg}`}>
                <kpi.icon className={`h-4 w-4 ${kpi.iconColor}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpiValues[kpi.key]}</div>
            </CardContent>
          </Card>
        ))}
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
