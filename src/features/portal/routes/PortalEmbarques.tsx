import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { getEstadoColor } from "@/lib/ui/uiMappings";
import { calcularEstadoEmbarque } from "@/features/embarques/domain/embarque";
import { getOrigen, getDestino } from "@/lib/formatters";
import EmbarqueCard from "@/features/portal/components/EmbarqueCard";
import EmptyState from "@/components/empty/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { PortalFiltersBar } from "@/components/shared/PortalFiltersBar";
import { PortalEmbarquesMobileFilters } from "@/features/portal/components/PortalEmbarquesMobileFilters";
import { Ship, Package, ChevronDown } from "lucide-react";
import { usePortalEmbarquesController } from "@/features/portal/hooks";
import { useIsMobile, useDocumentTitle } from "@/hooks/shared";
import { LoadingState } from "@/components/shared/states/LoadingState";

export default function PortalEmbarques() {
  useDocumentTitle('Mis Embarques');
  const isMobile = useIsMobile();
  const {
    isLoading,
    isError,
    refetch,
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

  // R-05: sin retry el portal se quedaba en esqueleto indefinido si la API fallaba.
  if (isLoading || isError) {
    return (
      <LoadingState
        label="Cargando tus embarques…"
        error={isError}
        onRetry={() => { void refetch(); }}
        errorLabel="No pudimos cargar tus embarques."
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<Ship className="h-6 w-6 text-accent" />}
        title="Mis Embarques"
        actions={<span className="text-sm text-muted-foreground tabular-nums">{filtered.length} de {embarques.length}</span>}
      />


      <PortalFiltersBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Buscar por expediente, ruta..."
        selects={[
          {
            value: filtroEstado,
            onChange: setFiltroEstado,
            options: estados,
            placeholder: "Estado",
            allLabel: "Todos los estados",
          },
          {
            value: filtroModo,
            onChange: setFiltroModo,
            options: modos,
            placeholder: "Modo",
            allLabel: "Todos los modos",
            icon: <Ship className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />,
            width: "sm:w-[180px]",
          },
        ]}
      />

      <PortalEmbarquesMobileFilters
        search={search}
        onSearchChange={setSearch}
        estados={estados}
        modos={modos}
        filtroEstado={filtroEstado}
        setFiltroEstado={setFiltroEstado}
        filtroModo={filtroModo}
        setFiltroModo={setFiltroModo}
      />


      {filtered.length === 0 ? (
        <EmptyState
          icon={Ship}
          title={search || filtroEstado !== "todos" || filtroModo !== "todos" ? "No se encontraron embarques" : "Aún no tienes embarques"}
          description={search || filtroEstado !== "todos" || filtroModo !== "todos"
            ? "Ajusta los filtros o busca con otro término."
            : "Aquí darás seguimiento a tus embarques: ruta, fechas estimadas y documentos."}
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
              const st = calcularEstadoEmbarque(item.modo, item.tipo, item.etd, item.eta, item.estado);
              acc[st] = (acc[st] || 0) + 1;
              return acc;
            }, {} as Record<string, number>);
            const firstItem = items[0];
            const ruta = `${getOrigen(firstItem)} → ${getDestino(firstItem)}`;
            return (
              <Collapsible key={expediente} defaultOpen={!isMobile}>
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
                          <Badge key={estado} variant="outline" className={`${getEstadoColor(estado)} text-2xs px-1.5 py-0`}>
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
