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
import EmptyState from "@/components/empty/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
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
      <PageHeader
        title="Mis Embarques"
        actions={<span className="text-sm text-muted-foreground tabular-nums">{filtered.length} de {embarques.length}</span>}
      />

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
          <SelectTrigger className="w-full sm:w-[200px]" aria-label="Filtrar por estado" title="Estado">
            <Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los estados</SelectItem>
            {estados.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filtroModo} onValueChange={setFiltroModo}>
          <SelectTrigger className="w-full sm:w-[180px]" aria-label="Filtrar por modo" title="Modo">
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
        <EmptyState
          icon={Ship}
          title="No se encontraron embarques"
          description="Ajusta los filtros o busca con otro término."
          primaryAction={search || filtroEstado !== "todos" || filtroModo !== "todos" ? {
            label: "Limpiar filtros",
            variant: "outline",
            onClick: () => { setSearch(""); setFiltroEstado("todos"); setFiltroModo("todos"); },
          } : undefined}
        />
      ) : (
        <div className="grid gap-3">
          {grouped.map(([expediente, items]) => {
            if (items.length === 1) {
              const e = items[0];
              return <EmbarqueCard key={e.id} e={e} />;
            }
            const statusCounts = items.reduce((acc, item) => {
              const st = calcularEstadoEmbarque(item.modo, item.tipo, item.etd, item.eta, item.estado, item.fecha_llegada_real);
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
