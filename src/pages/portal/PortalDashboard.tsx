import { Ship, FileText, Receipt, Clock, TrendingUp, Calendar, ArrowRight, Package } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { usePortalEmbarques, usePortalCotizaciones, usePortalFacturas, usePortalClientUsers, usePortalClienteName, usePortalOrgName } from "@/hooks/usePortalData";
import { getEstadoColor, getModoIcon, getEstadoBarColor } from "@/lib/uiMappings";
import { calcularEstadoEmbarque } from "@/lib/embarqueLogic";
import { ESTADOS_EMBARQUE } from "@/data/embarqueConstants";
import { formatCurrency } from "@/lib/formatters";
import { Link } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { format, parseISO, isAfter, addDays } from "date-fns";
import { es } from "date-fns/locale";
import { useMemo } from "react";

const kpis = [
  { key: "embarques" as const, label: "Embarques Activos", icon: Ship, href: "/portal/embarques", color: "text-accent", bg: "bg-accent/10" },
  { key: "cotizaciones" as const, label: "Cotizaciones", icon: FileText, href: "/portal/cotizaciones", color: "text-violet-600", bg: "bg-violet-100" },
  { key: "facturas" as const, label: "Facturas Pendientes", icon: Receipt, href: "/portal/facturas", color: "text-amber-600", bg: "bg-amber-100" },
];

export default function PortalDashboard() {
  const { data: clientUsers = [] } = usePortalClientUsers();
  const { data: clienteName } = usePortalClienteName();
  const { data: orgName } = usePortalOrgName();
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

  // Próximos arribos (embarques con ETA en próximos 14 días)
  const proximosArribos = useMemo(() => {
    const hoy = new Date();
    const en14Dias = addDays(hoy, 14);
    return embarquesActivos
      .filter((e) => {
        if (!e.eta) return false;
        try {
          const etaDate = parseISO(e.eta);
          return isAfter(etaDate, hoy) && !isAfter(etaDate, en14Dias);
        } catch { return false; }
      })
      .sort((a, b) => (a.eta! > b.eta! ? 1 : -1))
      .slice(0, 5);
  }, [embarquesActivos]);

  // Distribución por estado
  const estadoDistribucion = useMemo(() => {
    const counts: Record<string, number> = {};
    embarquesActivos.forEach((e) => {
      const est = calcularEstadoEmbarque(e.modo, e.tipo, e.etd, e.eta, e.estado);
      counts[est] = (counts[est] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => {
      const idxA = (ESTADOS_EMBARQUE as readonly string[]).indexOf(a[0]);
      const idxB = (ESTADOS_EMBARQUE as readonly string[]).indexOf(b[0]);
      return (idxA === -1 ? 99 : idxA) - (idxB === -1 ? 99 : idxB);
    });
  }, [embarquesActivos]);

  // Monto total facturas pendientes
  const montoFacturasPendientes = useMemo(() => {
    return facturasPendientes.reduce((sum, f) => sum + f.total, 0);
  }, [facturasPendientes]);

  if (loadingEmb || loadingCot || loadingFac) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-32" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div className="bg-gradient-to-r from-accent/5 via-accent/3 to-transparent rounded-xl p-6 border">
        <h1 className="text-2xl font-bold">
          {clienteName ? `¡Hola, ${clienteName}!` : "Bienvenido"}
        </h1>
        {orgName && (
          <p className="text-sm text-muted-foreground mt-1">
            Portal de <span className="font-medium text-foreground">{orgName}</span>
          </p>
        )}
        <p className="text-sm text-muted-foreground mt-1">
          Consulta el estado de tus embarques, cotizaciones y facturas en un solo lugar.
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {kpis.map((kpi) => (
          <Link key={kpi.key} to={kpi.href}>
            <Card className="hover:shadow-md transition-all hover:border-accent/30 cursor-pointer group">
              <CardContent className="flex items-center gap-4 p-5">
                <div className={`rounded-xl p-3 ${kpi.bg} transition-colors`}>
                  <kpi.icon className={`h-5 w-5 ${kpi.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground font-medium">{kpi.label}</p>
                  <p className="text-2xl font-bold mt-0.5">{kpiValues[kpi.key]}</p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Estado de embarques */}
        {embarquesActivos.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-accent" />
                Estado de Embarques
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {estadoDistribucion.map(([estado, count]) => (
                <div key={estado} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <Badge className={`${getEstadoColor(estado)} text-xs`}>{estado}</Badge>
                  </div>
                  <span className="text-muted-foreground font-medium">{count}</span>
                </div>
              ))}
              {/* Barra apilada de distribución */}
              <div className="flex h-2.5 rounded-full overflow-hidden mt-2">
                {estadoDistribucion.map(([estado, count]) => {
                  const pct = (count / embarquesActivos.length) * 100;
                  return (
                    <div
                      key={estado}
                      className={`${getEstadoBarColor(estado)} transition-all`}
                      style={{ width: `${pct}%` }}
                      title={`${estado}: ${count}`}
                    />
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground text-center">
                {embarquesActivos.length} embarque{embarquesActivos.length !== 1 ? "s" : ""} activo{embarquesActivos.length !== 1 ? "s" : ""}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Próximos Arribos */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <Calendar className="h-4 w-4 text-accent" />
                Próximos Arribos
              </CardTitle>
              <Link to="/portal/embarques">
                <Button variant="ghost" size="sm" className="text-xs h-7">
                  Ver todos <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {proximosArribos.length === 0 ? (
              <div className="text-center py-8">
                <Package className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">No hay arribos próximos.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {proximosArribos.map((e) => (
                  <Link
                    key={e.id}
                    to={`/portal/embarques/${e.id}`}
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-lg flex-shrink-0">{getModoIcon(e.modo)}</span>
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{e.expediente}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {e.puerto_destino || e.aeropuerto_destino || e.ciudad_destino || "—"}
                        </p>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0 ml-2">
                      <p className="text-xs font-medium text-accent">
                        {e.eta ? format(parseISO(e.eta), "dd MMM", { locale: es }) : "—"}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Facturación pendiente + Embarques recientes */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Facturación pendiente */}
        {facturasPendientes.length > 0 && (
          <Card className="lg:col-span-1">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Receipt className="h-4 w-4 text-amber-600" />
                Facturación Pendiente
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{formatCurrency(montoFacturasPendientes, "MXN")}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {facturasPendientes.length} factura{facturasPendientes.length !== 1 ? "s" : ""} por pagar
              </p>
              <div className="mt-4 space-y-2">
                {facturasPendientes.filter((f) => f.estado === "Vencida").length > 0 && (
                  <div className="flex items-center gap-2 text-xs p-2 rounded bg-destructive/10 text-destructive">
                    <span className="font-medium">⚠️ {facturasPendientes.filter((f) => f.estado === "Vencida").length} vencida(s)</span>
                  </div>
                )}
              </div>
              <Link to="/portal/facturas">
                <Button variant="outline" size="sm" className="w-full mt-4 text-xs">
                  Ver facturas <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {/* Recent embarques */}
        <Card className={facturasPendientes.length > 0 ? "lg:col-span-2" : "lg:col-span-3"}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <Ship className="h-4 w-4 text-accent" />
                Embarques Recientes
              </CardTitle>
              <Link to="/portal/embarques">
                <Button variant="ghost" size="sm" className="text-xs h-7">
                  Ver todos <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {embarquesActivos.length === 0 ? (
              <div className="text-center py-8">
                <Ship className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">No hay embarques activos.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {embarquesActivos.slice(0, 5).map((e) => {
                  const estadoVisual = calcularEstadoEmbarque(e.modo, e.tipo, e.etd, e.eta, e.estado);
                  return (
                    <Link
                      key={e.id}
                      to={`/portal/embarques/${e.id}`}
                      className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-lg flex-shrink-0">{getModoIcon(e.modo)}</span>
                        <div className="min-w-0">
                          <p className="font-medium text-sm">{e.expediente}</p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3 flex-shrink-0" />
                            <span className="truncate">
                              {e.puerto_origen || e.aeropuerto_origen || e.ciudad_origen || "—"} →{" "}
                              {e.puerto_destino || e.aeropuerto_destino || e.ciudad_destino || "—"}
                            </span>
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                        {e.eta && (
                          <span className="text-[10px] text-muted-foreground hidden sm:block">
                            ETA {format(parseISO(e.eta), "dd/MM", { locale: es })}
                          </span>
                        )}
                        <Badge className={getEstadoColor(estadoVisual)}>{estadoVisual}</Badge>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
