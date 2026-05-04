import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePortalFacturas, usePortalClientUsers } from "@/hooks/portal/usePortalData";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { getEstadoColor } from "@/lib/ui/uiMappings";
import { Search, Receipt, Filter, AlertTriangle } from "lucide-react";
import EmptyState from "@/components/empty/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { useState, useMemo } from "react";

export default function PortalFacturas() {
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
          f.expediente.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [facturas, search, filtroEstado]);

  if (isLoading) {
    return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-12 w-full" /><Skeleton className="h-64 w-full" /></div>;
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Mis Facturas"
        actions={<span className="text-sm text-muted-foreground tabular-nums">{filtered.length} de {facturas.length}</span>}
      />

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por número, expediente..."
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
          {facturas.length > 0 && filtered.map((f) => (
            <Card key={f.id} className="transition-all hover:shadow-sm">
              <CardContent className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <Badge className={`${getEstadoColor(f.estado)} text-[11px] shrink-0`}>
                    {f.estado}
                  </Badge>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm font-mono tabular-nums">{f.numero}</p>
                      {f.estado === "Vencida" && <AlertTriangle className="h-3.5 w-3.5 text-destructive" />}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      Exp: <span className="font-mono">{f.expediente}</span> • Emisión: {f.fecha_emision ? formatDate(f.fecha_emision) : "—"}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Vence: {f.fecha_vencimiento ? formatDate(f.fecha_vencimiento) : "—"}
                    </p>
                  </div>
                </div>
                <p className="text-sm font-bold tabular-nums shrink-0 text-right min-w-[110px]">
                  {formatCurrency(f.total, f.moneda)}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
