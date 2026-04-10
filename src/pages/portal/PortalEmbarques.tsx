import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePortalEmbarques, usePortalClientUsers } from "@/hooks/usePortalData";
import { getEstadoColor, getModoIcon } from "@/lib/helpers";
import { calcularEstadoEmbarque } from "@/hooks/useEmbarques";
import { Search, Ship, Filter, Calendar, Package } from "lucide-react";
import { useState, useMemo } from "react";
import { format, parseISO } from "date-fns";


export default function PortalEmbarques() {
  const { data: clientUsers = [] } = usePortalClientUsers();
  const clienteIds = clientUsers.map((cu) => cu.cliente_id);
  const { data: embarques = [], isLoading } = usePortalEmbarques(clienteIds);
  const [search, setSearch] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("todos");
  const [filtroModo, setFiltroModo] = useState("todos");

  // Get unique estados and modos for filters
  const { estados, modos } = useMemo(() => {
    const estadoSet = new Set<string>();
    const modoSet = new Set<string>();
    embarques.forEach((e) => {
      estadoSet.add(calcularEstadoEmbarque(e.modo, e.tipo, e.etd, e.eta, e.estado));
      modoSet.add(e.modo);
    });
    return { estados: Array.from(estadoSet).sort(), modos: Array.from(modoSet).sort() };
  }, [embarques]);

  const filtered = useMemo(() => {
    return embarques.filter((e) => {
      const estadoVisual = calcularEstadoEmbarque(e.modo, e.tipo, e.etd, e.eta, e.estado);
      
      if (filtroEstado !== "todos" && estadoVisual !== filtroEstado) return false;
      if (filtroModo !== "todos" && e.modo !== filtroModo) return false;
      
      if (search) {
        const q = search.toLowerCase();
        const ruta = `${e.puerto_origen || ""} ${e.puerto_destino || ""} ${e.aeropuerto_origen || ""} ${e.aeropuerto_destino || ""} ${e.ciudad_origen || ""} ${e.ciudad_destino || ""}`.toLowerCase();
        return (
          e.expediente.toLowerCase().includes(q) ||
          e.cliente_nombre.toLowerCase().includes(q) ||
          ruta.includes(q) ||
          estadoVisual.toLowerCase().includes(q) ||
          (e.contenedor && e.contenedor.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [embarques, search, filtroEstado, filtroModo]);

  // Group filtered embarques by expediente
  const grouped = useMemo(() => {
    const map = new Map<string, typeof filtered>();
    filtered.forEach((e) => {
      const key = e.expediente;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    });
    return Array.from(map.entries());
  }, [filtered]);

  if (isLoading) {
    return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-12 w-full" /><Skeleton className="h-64 w-full" /></div>;
  }

  const getOrigen = (e: typeof filtered[0]) => e.puerto_origen || e.aeropuerto_origen || e.ciudad_origen || "—";
  const getDestino = (e: typeof filtered[0]) => e.puerto_destino || e.aeropuerto_destino || e.ciudad_destino || "—";

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Mis Embarques</h1>
        <span className="text-sm text-muted-foreground">{filtered.length} embarques · {grouped.length} expedientes</span>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por expediente, ruta..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filtroEstado} onValueChange={setFiltroEstado}>
          <SelectTrigger className="w-full sm:w-44">
            <Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los estados</SelectItem>
            {estados.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filtroModo} onValueChange={setFiltroModo}>
          <SelectTrigger className="w-full sm:w-40">
            <Ship className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
            <SelectValue placeholder="Modo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los modos</SelectItem>
            {modos.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <Ship className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-muted-foreground font-medium">No se encontraron embarques</p>
          <p className="text-xs text-muted-foreground mt-1">Ajusta los filtros o busca con otro término.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {grouped.map(([expediente, items]) => {
            if (items.length === 1) {
              // Single embarque — render as simple card
              const e = items[0];
              const estadoVisual = calcularEstadoEmbarque(e.modo, e.tipo, e.etd, e.eta, e.estado);
              return (
                <Link key={e.id} to={`/portal/embarques/${e.id}`}>
                  <Card className="hover:shadow-md transition-all hover:border-accent/30 group">
                    <CardContent className="flex items-center justify-between p-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="rounded-lg bg-muted/60 p-2 flex-shrink-0">
                          <span className="text-lg">{getModoIcon(e.modo)}</span>
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-sm">{e.expediente}{e.contenedor ? ` - ${e.contenedor}` : ""}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {getOrigen(e)} → {getDestino(e)}
                          </p>
                          <div className="flex items-center gap-3 mt-1 flex-wrap">
                            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                              <Calendar className="h-3 w-3" />
                              ETD: {e.etd ? format(parseISO(e.etd), "dd/MM/yy") : "—"}
                            </span>
                            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                              ETA: {e.eta ? format(parseISO(e.eta), "dd/MM/yy") : "—"}
                            </span>
                            <span className="text-[10px] text-muted-foreground">{e.tipo}</span>
                          </div>
                        </div>
                      </div>
                      <Badge className={`${getEstadoColor(estadoVisual)} flex-shrink-0 ml-2`}>{estadoVisual}</Badge>
                    </CardContent>
                  </Card>
                </Link>
              );
            }

            // Multiple embarques — grouped card
            const first = items[0];
            return (
              <Card key={expediente} className="overflow-hidden">
                {/* Group header */}
                <div className="flex items-center justify-between gap-3 p-4 bg-muted/40">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="rounded-lg bg-muted p-2 flex-shrink-0">
                      <span className="text-lg">{getModoIcon(first.modo)}</span>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-sm">{expediente}</p>
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          <Package className="h-3 w-3 mr-0.5" />
                          {items.length} contenedores
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {getOrigen(first)} → {getDestino(first)} · {first.tipo}
                      </p>
                    </div>
                  </div>
                </div>
                {/* Sub-rows */}
                <div className="divide-y divide-border">
                  {items.map((e) => {
                    const estadoVisual = calcularEstadoEmbarque(e.modo, e.tipo, e.etd, e.eta, e.estado);
                    return (
                      <Link
                        key={e.id}
                        to={`/portal/embarques/${e.id}`}
                        className="flex items-center justify-between px-4 py-2.5 hover:bg-muted/30 transition-colors"
                      >
                        <div className="flex items-center gap-4 min-w-0">
                          <span className="text-sm font-medium truncate min-w-[120px]">
                            {e.contenedor || "(sin contenedor)"}
                          </span>
                          <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                            <Calendar className="h-3 w-3" />
                            ETD: {e.etd ? format(parseISO(e.etd), "dd/MM/yy") : "—"}
                          </span>
                          <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                            ETA: {e.eta ? format(parseISO(e.eta), "dd/MM/yy") : "—"}
                          </span>
                        </div>
                        <Badge className={`${getEstadoColor(estadoVisual)} flex-shrink-0 ml-2`}>{estadoVisual}</Badge>
                      </Link>
                    );
                  })}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
