import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePortalFacturas, usePortalClientUsers } from "@/hooks/usePortalData";
import { formatCurrency } from "@/lib/formatters";
import { Search, Receipt, Filter, AlertTriangle } from "lucide-react";
import { useState, useMemo } from "react";

const estadoColor: Record<string, string> = {
  Borrador: "bg-muted text-muted-foreground",
  Emitida: "bg-accent/10 text-accent border-accent/30",
  Pagada: "bg-green-100 text-green-700 border-green-300",
  Vencida: "bg-destructive/10 text-destructive border-destructive/30",
  Cancelada: "bg-muted text-muted-foreground",
};

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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Mis Facturas</h1>
        <span className="text-sm text-muted-foreground">{filtered.length} de {facturas.length}</span>
      </div>

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
          <Receipt className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-muted-foreground font-medium">No se encontraron facturas</p>
          <p className="text-xs text-muted-foreground mt-1">Ajusta los filtros o busca con otro término.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {facturas.length > 0 && filtered.map((f) => (
            <Card key={f.id} className="transition-all hover:shadow-sm">
              <CardContent className="flex items-center justify-between p-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm">{f.numero}</p>
                    {f.estado === "Vencida" && <AlertTriangle className="h-3.5 w-3.5 text-destructive" />}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    Exp: {f.expediente} • Emisión: {f.fecha_emision}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Vence: {f.fecha_vencimiento}
                  </p>
                </div>
                <div className="text-right space-y-1.5 flex-shrink-0 ml-3 flex flex-col items-end">
                  <Badge className={`${estadoColor[f.estado] ?? "bg-muted text-muted-foreground"} text-xs border`}>
                    {f.estado}
                  </Badge>
                  <p className="text-sm font-bold">{formatCurrency(f.total, f.moneda)}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
