import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { PageSkeleton } from "@/components/shared/skeletons";
import { usePortalFacturas, usePortalClientUsers } from "@/features/portal/hooks";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { getEstadoColor } from "@/lib/ui/uiMappings";
import { resolverEstadoFacturaCliente } from "@/lib/domain/estadosFactura";
import { Receipt, AlertTriangle, ChevronRight } from "lucide-react";
import EmptyState from "@/components/empty/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { PortalFiltersBar } from "@/components/shared/PortalFiltersBar";
import { PortalFacturasMobileFilters } from "@/features/portal/components/facturas/PortalFacturasMobileFilters";
import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useDocumentTitle } from "@/hooks/shared";

export default function PortalFacturas() {
  useDocumentTitle('Mis Facturas');
  const { data: clientUsers = [] } = usePortalClientUsers();
  const clienteIds = clientUsers.map((cu) => cu.cliente_id);
  const { data: facturas = [], isLoading } = usePortalFacturas(clienteIds);
  const [search, setSearch] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("todos");

  const estados = useMemo(() => {
    const set = new Set(facturas.map((f) => f.estado));
    return Array.from(set).sort();
  }, [facturas]);

  const filtered = useMemo(() => {
    return facturas.filter((f) => {
      if (filtroEstado !== "todos" && f.estado !== filtroEstado) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          f.numero.toLowerCase().includes(q) ||
          (f.expediente ?? "").toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [facturas, search, filtroEstado]);

  if (isLoading) {
    return <PageSkeleton />;
  }

  return (
    <div className="space-y-5">
      <PageHeader
        icon={<Receipt className="h-6 w-6 text-accent" />}
        title="Mis Facturas"
        actions={<span className="text-sm text-muted-foreground tabular-nums">{filtered.length} de {facturas.length}</span>}
      />


      <PortalFiltersBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Buscar por número, expediente..."
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

      <PortalFacturasMobileFilters
        search={search}
        onSearchChange={setSearch}
        estados={estados}
        filtroEstado={filtroEstado}
        setFiltroEstado={setFiltroEstado}
      />

      {filtered.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="No se encontraron facturas"
          description="Ajusta los filtros o busca con otro término."
          primaryAction={search || filtroEstado !== "todos" ? {
            label: "Limpiar filtros",
            variant: "outline",
            onClick: () => { setSearch(""); setFiltroEstado("todos"); },
          } : undefined}
        />
      ) : (
        <div className="grid gap-3">
          {facturas.length > 0 && filtered.map((f) => {
            // B-083: misma clasificación que el estado de cuenta — una
            // Emitida/Parcialmente pagada ya vencida se muestra "Vencida".
            const estadoVisible = resolverEstadoFacturaCliente(f.estado, f.fecha_vencimiento);
            return (
            <Card key={f.id} className="transition-all hover:shadow-raised hover:border-accent/40 focus-within:ring-2 focus-within:ring-accent/40">
              <Link
                to={`/portal/facturas/${f.id}`}
                aria-label={`Ver factura ${f.numero}`}
                className="block focus:outline-none"
              >
                <CardContent className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <Badge className={`${getEstadoColor(estadoVisible)} text-xs shrink-0`}>
                      {estadoVisible}
                    </Badge>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm font-mono tabular-nums">{f.numero}</p>
                        {estadoVisible === "Vencida" && <AlertTriangle className="h-3.5 w-3.5 text-destructive" />}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        Exp: <span className="font-mono">{f.expediente || (f as { embarque_expediente?: string | null }).embarque_expediente || "—"}</span> • Emisión: {f.fecha_emision ? formatDate(f.fecha_emision) : "—"}
                      </p>
                      <p className="text-2xs text-muted-foreground mt-0.5">
                        Vence: {f.fecha_vencimiento ? formatDate(f.fecha_vencimiento) : "—"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <p className="text-sm font-bold tabular-nums text-right min-w-[110px]">
                      {formatCurrency(f.total, f.moneda)}
                    </p>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
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
