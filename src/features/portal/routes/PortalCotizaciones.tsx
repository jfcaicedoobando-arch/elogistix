import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { PageSkeleton } from "@/components/shared/skeletons";
import { usePortalCotizaciones, usePortalClientUsers } from "@/features/portal/hooks";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { getEstadoColor } from "@/lib/ui/uiMappings";
import { ClipboardList, Ship } from "lucide-react";
import EmptyState from "@/components/empty/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { PortalFiltersBar } from "@/components/shared/PortalFiltersBar";
import { PortalCotizacionesMobileFilters } from "@/features/portal/components/PortalCotizacionesMobileFilters";
import { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTasaIVA } from "@/features/catalogos/hooks/useTasaIVA";
import { calcularDesgloseMoneda, parseConceptos } from "@/lib/domain/cotizacionDetalle";

export default function PortalCotizaciones() {
  const navigate = useNavigate();
  const { data: clientUsers = [] } = usePortalClientUsers();
  const clienteIds = clientUsers.map((cu) => cu.cliente_id);
  const { data: cotizaciones = [], isLoading } = usePortalCotizaciones(clienteIds);
  const tasaIva = useTasaIVA();
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
    return <PageSkeleton />;
  }

  return (
    <div className="space-y-5">
      <PageHeader
        icon={<ClipboardList className="h-6 w-6 text-accent" />}
        title="Mis Cotizaciones"
        actions={<span className="text-sm text-muted-foreground tabular-nums">{filtered.length} de {cotizaciones.length}</span>}
      />

      <PortalFiltersBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Buscar por folio, ruta..."
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

      <PortalCotizacionesMobileFilters
        search={search}
        onSearchChange={setSearch}
        estados={estados}
        filtroEstado={filtroEstado}
        setFiltroEstado={setFiltroEstado}
      />

      {filtered.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
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
            // B-099: mostrar el TOTAL de la moneda de la cotización (subtotal
            // + IVA por fila), igual que el detalle; fallback al subtotal
            // crudo si la cotización legacy no trae conceptos parseables.
            const conceptosMoneda = parseConceptos((c as { conceptos_venta?: unknown }).conceptos_venta)
              .filter((cv) => cv.moneda === c.moneda);
            const totalLista = conceptosMoneda.length > 0
              ? calcularDesgloseMoneda(conceptosMoneda, tasaIva, c.moneda === "MXN").total
              : Number(c.subtotal ?? 0);
            return (
              <Card
                key={c.id}
                className="transition-all hover:shadow-raised hover:border-accent/30 focus-within:ring-2 focus-within:ring-accent/40 group"
              >
                <Link
                  to={`/portal/cotizaciones/${c.id}`}
                  aria-label={`Ver cotización ${c.folio}`}
                  className="block focus:outline-none"
                >
                  <CardContent className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <Badge className={`${getEstadoColor(c.estado)} text-xs shrink-0`}>
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
                            {/* B-103: fecha date-only → sólo fecha (no "00:00"). */}
                            {fechaRespuestaLabel} el {formatDate(fechaRespuesta, fechaRespuesta.includes("T") ? "dd/MM/yyyy HH:mm" : "dd/MM/yyyy")}
                          </p>
                        )}
                        {tieneEmbarque && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              navigate(`/portal/embarques/${c.embarque_id}`);
                            }}
                            className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-success hover:underline"
                          >
                            <Ship className="h-3 w-3" />
                            En operación · {expediente}
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="text-sm font-bold tabular-nums shrink-0 text-right min-w-[110px]">
                      {formatCurrency(totalLista, c.moneda)}
                    </p>
                  </CardContent>
                </Link>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
