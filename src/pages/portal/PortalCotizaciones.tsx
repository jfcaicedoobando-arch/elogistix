import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePortalCotizaciones, usePortalClientUsers } from "@/hooks/portal";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { getEstadoColor } from "@/lib/ui/uiMappings";
import { Search, FileText, Filter, Ship } from "lucide-react";
import EmptyState from "@/components/empty/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { useState, useMemo } from "react";

export default function PortalCotizaciones() {
  const navigate = useNavigate();
  const { data: clientUsers = [] } = usePortalClientUsers();
  const clienteIds = clientUsers.map((cu) => cu.cliente_id);
  const { data: cotizaciones = [], isLoading } = usePortalCotizaciones(clienteIds);
  const [search, setSearch] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("todos");

  const estados = useMemo(() => {
    const set = new Set(cotizaciones.map((c) => c.estado));
    return Array.from(set).sort();
  }, [cotizaciones]);

  const filtered = useMemo(() => {
    return cotizaciones.filter((c) => {
      if (filtroEstado !== "todos" && c.estado !== filtroEstado) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          c.folio.toLowerCase().includes(q) ||
          (c.origen || "").toLowerCase().includes(q) ||
          (c.destino || "").toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [cotizaciones, search, filtroEstado]);

  if (isLoading) {
    return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-12 w-full" /><Skeleton className="h-64 w-full" /></div>;
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Mis Cotizaciones"
        actions={<span className="text-sm text-muted-foreground tabular-nums">{filtered.length} de {cotizaciones.length}</span>}
      />

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por folio, ruta..."
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
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No se encontraron cotizaciones"
          description="Ajusta los filtros o busca con otro término."
          primaryAction={search || filtroEstado !== "todos" ? {
            label: "Limpiar filtros",
            variant: "outline",
            onClick: () => { setSearch(""); setFiltroEstado("todos"); },
          } : undefined}
        />
      ) : (
        <div className="grid gap-3">
          {filtered.map((c) => {
            const expediente = (c as { embarque_expediente?: string | null }).embarque_expediente;
            const tieneEmbarque = Boolean(c.embarque_id && expediente);
            return (
              <Card
                key={c.id}
                className="cursor-pointer transition-all hover:shadow-sm hover:border-accent/30 group"
                onClick={() => navigate(`/portal/cotizaciones/${c.id}`)}
              >
                <CardContent className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <Badge className={`${getEstadoColor(c.estado)} text-[11px] shrink-0`}>
                      {c.estado}
                    </Badge>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm font-mono tabular-nums">{c.folio}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {c.modo} • {c.tipo} • {c.origen || "—"} → {c.destino || "—"}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Vigencia: {c.fecha_vigencia ? formatDate(c.fecha_vigencia) : "—"}
                      </p>
                      {tieneEmbarque && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/portal/embarques/${c.embarque_id}`);
                          }}
                          className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-success hover:underline"
                        >
                          <Ship className="h-3 w-3" />
                          En operación · {expediente}
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="text-sm font-bold tabular-nums shrink-0 text-right min-w-[110px]">
                    {formatCurrency(c.subtotal, c.moneda)}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
