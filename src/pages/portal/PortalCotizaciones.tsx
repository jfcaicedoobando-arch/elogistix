import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePortalCotizaciones, usePortalClientUsers } from "@/hooks/usePortalData";
import { formatCurrency } from "@/lib/formatters";
import { Search, FileText, Filter } from "lucide-react";
import { useState, useMemo } from "react";

const estadoColor: Record<string, string> = {
  Borrador: "bg-muted text-muted-foreground",
  Enviada: "bg-accent/10 text-accent border-accent/30",
  Confirmada: "bg-green-100 text-green-700 border-green-300",
  Aceptada: "bg-green-100 text-green-700 border-green-300",
  Rechazada: "bg-destructive/10 text-destructive border-destructive/30",
  Vencida: "bg-amber-100 text-amber-700 border-amber-300",
  Embarcada: "bg-primary/10 text-primary border-primary/30",
};

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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Mis Cotizaciones</h1>
        <span className="text-sm text-muted-foreground">{filtered.length} de {cotizaciones.length}</span>
      </div>

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
          <SelectTrigger className="w-full sm:w-44">
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
        <div className="text-center py-16">
          <FileText className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-muted-foreground font-medium">No se encontraron cotizaciones</p>
          <p className="text-xs text-muted-foreground mt-1">Ajusta los filtros o busca con otro término.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((c) => (
            <Card
              key={c.id}
              className="cursor-pointer transition-all hover:shadow-md hover:border-accent/30 group"
              onClick={() => navigate(`/portal/cotizaciones/${c.id}`)}
            >
              <CardContent className="flex items-center justify-between p-4">
                <div className="min-w-0">
                  <p className="font-semibold text-sm">{c.folio}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {c.modo} • {c.tipo} • {c.origen || "—"} → {c.destino || "—"}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Vigencia: {c.fecha_vigencia || "—"}
                  </p>
                </div>
                <div className="text-right space-y-1.5 flex-shrink-0 ml-3 flex flex-col items-end">
                  <Badge className={`${estadoColor[c.estado] ?? "bg-muted text-muted-foreground"} text-xs border`}>
                    {c.estado}
                  </Badge>
                  <p className="text-sm font-bold">{formatCurrency(c.subtotal, c.moneda)}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
