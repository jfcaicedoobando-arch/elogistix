import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { usePortalCotizaciones, usePortalClientUsers } from "@/features/portal/hooks";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { getEstadoColor } from "@/lib/ui/uiMappings";
import { FileText, Ship } from "lucide-react";
import EmptyState from "@/components/empty/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { PortalFiltersBar } from "@/components/shared/PortalFiltersBar";
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

      <PortalFiltersBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Buscar por folio, ruta..."
        hideOnMobile={false}
        selects={[
          {
            value: filtroEstado,
            onChange: setFiltroEstado,
            options: estados,
            placeholder: "Estado",
            allLabel: "Todos los estados",
          },
        ]}
      />

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
            const fechaAceptacion = (c as { fecha_aceptacion?: string | null }).fecha_aceptacion ?? null;
            const fechaRechazo = (c as { fecha_rechazo?: string | null }).fecha_rechazo ?? null;
            const fechaRespuesta = fechaAceptacion ?? fechaRechazo;
            const fechaRespuestaLabel = fechaAceptacion ? "Aceptada" : fechaRechazo ? "Rechazada" : null;
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
                      <p className="text-2xs text-muted-foreground mt-0.5">
                        Vigencia: {c.fecha_vigencia ? formatDate(c.fecha_vigencia) : "—"}
                      </p>
                      {fechaRespuesta && fechaRespuestaLabel && (
                        <p className="text-2xs text-muted-foreground mt-0.5 tabular-nums">
                          {fechaRespuestaLabel} el {formatDate(fechaRespuesta, "dd/MM/yyyy HH:mm")}
                        </p>
                      )}
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
