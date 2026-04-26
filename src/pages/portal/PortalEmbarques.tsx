import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { getEstadoColor } from "@/lib/ui/uiMappings";
import { calcularEstadoEmbarque } from "@/lib/domain/embarque";
import { getOrigen, getDestino } from "@/lib/formatters";
import EmbarqueCard from "@/components/portal/EmbarqueCard";
import { Search, Ship, Filter, Package, ChevronDown } from "lucide-react";
import { usePortalEmbarquesController } from "@/hooks/portal/usePortalEmbarquesController";

export default function PortalEmbarques() {
  const {
    isLoading,
    embarques,
    filtered,
    grouped,
    estados,
    modos,
    search,
    setSearch,
    filtroEstado,
    setFiltroEstado,
    filtroModo,
    setFiltroModo,
  } = usePortalEmbarquesController();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Mis Embarques</h1>
        <span className="text-sm text-muted-foreground">{filtered.length} de {embarques.length}</span>
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
              const e = items[0];
              return <EmbarqueCard key={e.id} e={e} />;
            }
            const statusCounts = items.reduce((acc, item) => {
              const st = calcularEstadoEmbarque(item.modo, item.tipo, item.etd, item.eta, item.estado);
              acc[st] = (acc[st] || 0) + 1;
              return acc;
            }, {} as Record<string, number>);
            const firstItem = items[0];
            const ruta = `${getOrigen(firstItem)} → ${getDestino(firstItem)}`;
            return (
              <Collapsible key={expediente} defaultOpen>
                <Card className="border-dashed bg-muted/30 overflow-hidden">
                  <CollapsibleTrigger className="w-full cursor-pointer group">
                    <CardContent className="p-3 flex items-center justify-between">
                      <div className="flex flex-col gap-0.5 text-left">
                        <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                          <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 group-data-[state=closed]:-rotate-90" />
                          <Package className="h-4 w-4 text-muted-foreground" />
                          <span>{expediente}</span>
                          <span className="text-xs font-normal text-muted-foreground">· {items.length} contenedores</span>
                        </div>
                        <p className="text-xs text-muted-foreground ml-10">{ruta}</p>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {Object.entries(statusCounts).map(([estado, count]) => (
                          <Badge key={estado} variant="outline" className={`${getEstadoColor(estado)} text-[10px] px-1.5 py-0`}>
                            {count} {estado}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="overflow-hidden data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up">
                    <div className="px-3 pb-3 grid gap-2">
                      {items.map((e) => (
                        <EmbarqueCard key={e.id} e={e} />
                      ))}
                    </div>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            );
          })}
        </div>
      )}
    </div>
  );
}
