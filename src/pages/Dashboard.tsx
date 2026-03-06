import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Anchor, Plane, Warehouse, PackageCheck, AlertTriangle,
  CalendarClock, TrendingUp, Ship, ArrowRight, Clock,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useEmbarques, calcularEstadoEmbarque } from "@/hooks/useEmbarques";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/formatters";
import { formatDate, getModoIcon } from "@/lib/helpers";

// ─── Types ───────────────────────────────────────────────
interface EmbarqueConEstado {
  id: string;
  expediente: string;
  cliente_nombre: string;
  modo: string;
  tipo: string;
  estado: string;
  estadoReal: string;
  etd: string | null;
  eta: string | null;
  operador: string;
  puerto_origen?: string | null;
  puerto_destino?: string | null;
  aeropuerto_origen?: string | null;
  aeropuerto_destino?: string | null;
  ciudad_origen?: string | null;
  ciudad_destino?: string | null;
  created_at: string;
}

const ESTADOS_FILTRO = ["Confirmado", "En Tránsito", "En Aduana", "Entregado"] as const;
type EstadoFiltro = (typeof ESTADOS_FILTRO)[number];

const ESTADO_CONFIG: Record<EstadoFiltro, { icon: typeof Ship; gradient: string; border: string; text: string; glow: string }> = {
  Confirmado:   { icon: Anchor,       gradient: "from-[hsl(217,91%,60%)] to-[hsl(217,91%,45%)]", border: "border-info",   text: "text-info",   glow: "shadow-[0_0_20px_hsl(217,91%,60%,0.25)]" },
  "En Tránsito": { icon: Ship,        gradient: "from-[hsl(38,92%,50%)] to-[hsl(38,92%,38%)]",   border: "border-warning", text: "text-warning", glow: "shadow-[0_0_20px_hsl(38,92%,50%,0.25)]" },
  "En Aduana":   { icon: Warehouse,    gradient: "from-[hsl(15,80%,55%)] to-[hsl(0,84%,50%)]",    border: "border-destructive", text: "text-destructive", glow: "shadow-[0_0_20px_hsl(0,84%,60%,0.25)]" },
  Entregado:    { icon: PackageCheck,  gradient: "from-[hsl(142,71%,45%)] to-[hsl(142,71%,35%)]", border: "border-success", text: "text-success", glow: "shadow-[0_0_20px_hsl(142,71%,45%,0.25)]" },
};

// ─── Greeting ────────────────────────────────────────────
function getSaludo() {
  const h = new Date().getHours();
  if (h < 12) return "Buenos días";
  if (h < 19) return "Buenas tardes";
  return "Buenas noches";
}

// ─── Component ───────────────────────────────────────────
export default function Dashboard() {
  const navigate = useNavigate();
  const { data: embarques = [], isLoading } = useEmbarques();
  const [filtroEstado, setFiltroEstado] = useState<EstadoFiltro | null>(null);

  // Batch queries for profit
  const { data: ventasUSD = [] } = useQuery({
    queryKey: ["dashboard-ventas-usd"],
    queryFn: async () => {
      const { data } = await supabase.from("conceptos_venta").select("embarque_id, total").eq("moneda", "USD");
      return data ?? [];
    },
  });
  const { data: costosUSD = [] } = useQuery({
    queryKey: ["dashboard-costos-usd"],
    queryFn: async () => {
      const { data } = await supabase.from("conceptos_costo").select("embarque_id, monto").eq("moneda", "USD");
      return data ?? [];
    },
  });

  // ─── Derived data ──────────────────────────────────────
  const embarquesConEstado = useMemo<EmbarqueConEstado[]>(() =>
    embarques.map(e => ({
      ...e,
      estadoReal: calcularEstadoEmbarque(e.modo, e.etd, e.eta, e.estado),
    })),
    [embarques]
  );

  const activos = useMemo(() =>
    embarquesConEstado.filter(e => !["Cerrado", "Cotización", "Cancelado"].includes(e.estadoReal)),
    [embarquesConEstado]
  );

  const conteoPorEstado = useMemo(() => {
    const m: Record<EstadoFiltro, number> = { Confirmado: 0, "En Tránsito": 0, "En Aduana": 0, Entregado: 0 };
    activos.forEach(e => { if (e.estadoReal in m) m[e.estadoReal as EstadoFiltro]++; });
    return m;
  }, [activos]);

  const totalActivos = useMemo(() => Object.values(conteoPorEstado).reduce((s, v) => s + v, 0), [conteoPorEstado]);

  // Alertas demora
  const alertasDemora = useMemo(() => {
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    return activos
      .filter(e => e.estadoReal === "En Aduana" && e.eta)
      .map(e => {
        const eta = new Date(e.eta! + "T00:00:00");
        const diasLibres = 7; // default
        const diasDesdeEta = Math.floor((hoy.getTime() - eta.getTime()) / 864e5);
        const diasDemora = diasDesdeEta - diasLibres;
        return { ...e, diasDemora, diasDesdeEta };
      })
      .filter(e => e.diasDemora >= 0)
      .sort((a, b) => b.diasDemora - a.diasDemora);
  }, [activos]);

  // Próximos arribos
  const proximosArribos = useMemo(() => {
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    const en7 = new Date(hoy); en7.setDate(en7.getDate() + 7);
    return activos
      .filter(e => e.estadoReal === "En Tránsito" && e.eta)
      .map(e => {
        const eta = new Date(e.eta! + "T00:00:00");
        const diasRestantes = Math.ceil((eta.getTime() - hoy.getTime()) / 864e5);
        return { ...e, diasRestantes };
      })
      .filter(e => e.diasRestantes >= 0 && e.diasRestantes <= 7)
      .sort((a, b) => a.diasRestantes - b.diasRestantes);
  }, [activos]);

  // Profit USD
  const profitPorEmbarque = useMemo(() => {
    const ventaMap: Record<string, number> = {};
    const costoMap: Record<string, number> = {};
    ventasUSD.forEach(v => { ventaMap[v.embarque_id] = (ventaMap[v.embarque_id] || 0) + Number(v.total); });
    costosUSD.forEach(c => { costoMap[c.embarque_id] = (costoMap[c.embarque_id] || 0) + Number(c.monto); });

    return activos
      .map(e => {
        const venta = ventaMap[e.id] || 0;
        const costo = costoMap[e.id] || 0;
        const profit = venta - costo;
        const margen = venta !== 0 ? (profit / venta) * 100 : 0;
        return { ...e, ventaUSD: venta, costoUSD: costo, profit, margen };
      })
      .filter(e => e.ventaUSD > 0 || e.costoUSD > 0)
      .sort((a, b) => b.profit - a.profit);
  }, [activos, ventasUSD, costosUSD]);

  // Filtered list
  const embarquesFiltrados = useMemo(() =>
    filtroEstado ? activos.filter(e => e.estadoReal === filtroEstado) : activos,
    [activos, filtroEstado]
  );

  const hoyStr = new Date().toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  // ─── Render ────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-1">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{getSaludo()} 👋</h1>
          <p className="text-sm text-muted-foreground capitalize">{hoyStr}</p>
        </div>
        <Badge variant="secondary" className="text-xs w-fit">{activos.length} embarques activos</Badge>
      </div>

      {/* ── 1. Status cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {ESTADOS_FILTRO.map(estado => {
          const cfg = ESTADO_CONFIG[estado];
          const Icon = cfg.icon;
          const count = conteoPorEstado[estado];
          const pct = totalActivos ? (count / totalActivos) * 100 : 0;
          const selected = filtroEstado === estado;

          return (
            <Card
              key={estado}
              onClick={() => setFiltroEstado(selected ? null : estado)}
              className={`cursor-pointer transition-all duration-200 hover:scale-[1.02] border-2 ${
                selected ? `${cfg.border} ${cfg.glow}` : "border-transparent"
              }`}
            >
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className={`p-2 rounded-lg bg-gradient-to-br ${cfg.gradient}`}>
                    <Icon className="h-4 w-4 text-white" />
                  </div>
                  {isLoading ? <Skeleton className="h-8 w-10" /> : (
                    <span className="text-3xl font-extrabold tracking-tight">{count}</span>
                  )}
                </div>
                <p className="text-xs font-medium text-muted-foreground">{estado}</p>
                <Progress value={pct} className="h-1.5" />
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* ── 2. Alertas + Próximos Arribos ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Alertas demora */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              Alertas de Demora
              {alertasDemora.length > 0 && (
                <Badge variant="destructive" className="ml-auto text-[10px]">{alertasDemora.length}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-[280px] overflow-y-auto">
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)
            ) : alertasDemora.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Sin alertas de demora</p>
            ) : (
              alertasDemora.map(e => (
                <div
                  key={e.id}
                  onClick={() => navigate(`/embarques/${e.id}`)}
                  className="flex items-center gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                >
                  <div className={`shrink-0 h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                    e.diasDemora >= 5 ? "bg-destructive" : "bg-warning"
                  }`}>
                    {e.diasDemora}d
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{e.expediente}</p>
                    <p className="text-xs text-muted-foreground truncate">{e.cliente_nombre}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Próximos arribos */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-warning" />
              Próximos Arribos (7 días)
              {proximosArribos.length > 0 && (
                <Badge className="ml-auto text-[10px] bg-warning/15 text-warning border-warning/30">{proximosArribos.length}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-[280px] overflow-y-auto">
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)
            ) : proximosArribos.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Sin arribos próximos</p>
            ) : (
              proximosArribos.map(e => (
                <div
                  key={e.id}
                  onClick={() => navigate(`/embarques/${e.id}`)}
                  className="flex items-center gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                >
                  <div className="shrink-0 h-9 w-9 rounded-full bg-warning/15 flex items-center justify-center">
                    <Clock className="h-4 w-4 text-warning" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{e.expediente} — {e.cliente_nombre}</p>
                    <p className="text-xs text-muted-foreground">
                      ETA: {formatDate(e.eta!)} · {e.diasRestantes === 0 ? "Hoy" : `${e.diasRestantes} día${e.diasRestantes > 1 ? "s" : ""}`}
                    </p>
                  </div>
                  <span className="text-lg">{getModoIcon(e.modo)}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── 3. Profit USD ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-success" />
            Profit USD por Embarque
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : profitPorEmbarque.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Sin datos de conceptos USD</p>
          ) : (
            <div className="overflow-auto max-h-[320px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Expediente</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="text-right">Venta USD</TableHead>
                    <TableHead className="text-right">Costo USD</TableHead>
                    <TableHead className="text-right">Profit</TableHead>
                    <TableHead className="text-right">Margen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {profitPorEmbarque.map(e => (
                    <TableRow key={e.id} className="cursor-pointer" onClick={() => navigate(`/embarques/${e.id}`)}>
                      <TableCell className="font-medium">{e.expediente}</TableCell>
                      <TableCell className="max-w-[180px] truncate">{e.cliente_nombre}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(e.ventaUSD, "USD")}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(e.costoUSD, "USD")}</TableCell>
                      <TableCell className={`text-right font-semibold tabular-nums ${e.profit >= 0 ? "text-success" : "text-destructive"}`}>
                        {formatCurrency(e.profit, "USD")}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge className={`text-[10px] ${
                          e.margen > 15 ? "bg-success/15 text-success border-success/30" :
                          e.margen > 0 ? "bg-warning/15 text-warning border-warning/30" :
                          "bg-destructive/15 text-destructive border-destructive/30"
                        }`}>
                          {e.margen.toFixed(1)}%
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── 4. Lista filtrable ── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">
              Embarques Activos
              {filtroEstado && (
                <Badge className={`ml-2 text-[10px] ${ESTADO_CONFIG[filtroEstado].text}`}>{filtroEstado}</Badge>
              )}
            </CardTitle>
            {filtroEstado && (
              <button onClick={() => setFiltroEstado(null)} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                Limpiar filtro
              </button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : embarquesFiltrados.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No hay embarques{filtroEstado ? ` en estado "${filtroEstado}"` : ""}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Expediente</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Modo</TableHead>
                  <TableHead>Origen → Destino</TableHead>
                  <TableHead>ETD</TableHead>
                  <TableHead>ETA</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Operador</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {embarquesFiltrados.map(e => {
                  const origen = (e.puerto_origen || e.aeropuerto_origen || e.ciudad_origen || "-").split(",")[0];
                  const destino = (e.puerto_destino || e.aeropuerto_destino || e.ciudad_destino || "-").split(",")[0];
                  const cfg = ESTADO_CONFIG[e.estadoReal as EstadoFiltro];
                  return (
                    <TableRow key={e.id} className="cursor-pointer" onClick={() => navigate(`/embarques/${e.id}`)}>
                      <TableCell className="font-medium">{e.expediente}</TableCell>
                      <TableCell className="max-w-[180px] truncate">{e.cliente_nombre}</TableCell>
                      <TableCell>
                        <span className="flex items-center gap-1.5">
                          <span>{getModoIcon(e.modo)}</span>
                          <span className="text-xs">{e.modo}</span>
                        </span>
                      </TableCell>
                      <TableCell className="text-xs max-w-[180px] truncate">{origen} → {destino}</TableCell>
                      <TableCell className="text-xs">{e.etd ? formatDate(e.etd) : "-"}</TableCell>
                      <TableCell className="text-xs">{e.eta ? formatDate(e.eta) : "-"}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={`text-xs ${cfg ? `${cfg.text} bg-transparent border ${cfg.border}/30` : ""}`}>
                          {e.estadoReal}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">{e.operador}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
