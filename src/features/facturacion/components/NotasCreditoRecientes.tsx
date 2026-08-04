/**
 * Card consolidada de Notas de Crédito recientes para la pestaña Cobranza
 * (G de la auditoría 13.49.0). Filtros por estado y cliente, totales por
 * moneda y enlace a la factura asociada.
 */
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { formatCurrency, formatDate, toTitleCase } from "@/lib/formatters";
import { useNotasCreditoRecientes, type EstadoNotaCredito } from "@/features/facturacion/hooks";
import { EmptyStateInline } from "@/components/empty/EmptyStateInline";

const ESTADO_COLOR: Record<EstadoNotaCredito, string> = {
  Borrador: "bg-muted text-muted-foreground",
  Aprobada: "bg-warning/10 text-warning border-warning/20",
  Timbrada: "bg-info/10 text-info border-info/20",
  Aplicada: "bg-success/10 text-success border-success/20",
  Cancelada: "bg-destructive/10 text-destructive border-destructive/20",
};

const ESTADOS: Array<EstadoNotaCredito | "todos"> = ["todos", "Borrador", "Aprobada", "Timbrada", "Aplicada", "Cancelada"];

export function NotasCreditoRecientes() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [estado, setEstado] = useState<EstadoNotaCredito | "todos">("todos");
  const [cliente, setCliente] = useState<string>("todos");

  const { data = [], isLoading } = useNotasCreditoRecientes({
    estado, limit: 200,
  });

  const clientes = useMemo(() => {
    const set = new Map<string, string>();
    data.forEach((n) => { if (n.cliente_id) set.set(n.cliente_id, n.cliente_nombre); });
    return Array.from(set, ([id, nombre]) => ({ id, nombre })).sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [data]);

  const filtradas = useMemo(
    () => (cliente === "todos" ? data : data.filter((n) => n.cliente_id === cliente)),
    [data, cliente],
  );

  const totales = useMemo(() => {
    const acc: Record<string, number> = {};
    filtradas.forEach((n) => {
      if (n.estado === "Cancelada") return;
      acc[n.moneda] = (acc[n.moneda] ?? 0) + Number(n.monto);
    });
    return acc;
  }, [filtradas]);

  return (
    <Card>
      <CardContent className="p-0">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="w-full flex items-center justify-between p-3 hover:bg-muted/30"
        >
          <div className="flex items-center gap-3">
            <span className="font-medium text-sm">Notas de crédito recientes</span>
            <span className="text-xs text-muted-foreground">({data.length})</span>
            {Object.entries(totales).map(([mon, total]) => (
              <Badge key={mon} variant="outline" className="font-mono text-xs">
                {formatCurrency(total, mon)}
              </Badge>
            ))}
          </div>
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

        {open && (
          <div className="border-t">
            <div className="p-3 flex flex-wrap gap-2 items-center">
              <Select value={estado} onValueChange={(v) => setEstado(v as EstadoNotaCredito | "todos")}>
                <SelectTrigger className="w-[150px] h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ESTADOS.map((e) => <SelectItem key={e} value={e}>{e === "todos" ? "Todos los estados" : e}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={cliente} onValueChange={setCliente}>
                <SelectTrigger className="w-[220px] h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los clientes</SelectItem>
                  {clientes.map((c) => <SelectItem key={c.id} value={c.id}>{toTitleCase(c.nombre)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {isLoading ? (
              <EmptyStateInline loading message="Cargando…" />
            ) : filtradas.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">No hay notas de crédito que coincidan.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-muted-foreground border-y bg-muted/20">
                    <tr>
                      <th className="text-left py-2 px-3">Folio</th>
                      <th className="text-left py-2 px-3">Factura</th>
                      <th className="text-left py-2 px-3">Cliente</th>
                      <th className="text-left py-2 px-3">Fecha</th>
                      <th className="text-left py-2 px-3">Motivo</th>
                      <th className="text-left py-2 px-3">Estado</th>
                      <th className="text-right py-2 px-3">Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtradas.map((n) => (
                      <tr
                        key={n.id}
                        role="link"
                        tabIndex={0}
                        aria-label={`Ver factura ${n.factura_numero}`}
                        onClick={() => navigate(`/facturacion/${n.factura_id}`)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            navigate(`/facturacion/${n.factura_id}`);
                          }
                        }}
                        className="border-b last:border-0 hover:bg-muted/30 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                      >
                        <td className="py-2 px-3 font-mono text-xs whitespace-nowrap">{n.folio}</td>
                        <td className="py-2 px-3 whitespace-nowrap font-mono text-xs">
                          {n.factura_numero}
                        </td>
                        <td className="py-2 px-3 max-w-[200px] truncate" title={toTitleCase(n.cliente_nombre)}>
                          {toTitleCase(n.cliente_nombre)}
                        </td>
                        <td className="py-2 px-3 text-xs whitespace-nowrap">{formatDate(n.fecha_emision)}</td>
                        <td className="py-2 px-3 text-xs">{n.motivo}</td>
                        <td className="py-2 px-3">
                          <Badge variant="outline" className={ESTADO_COLOR[n.estado]}>{n.estado}</Badge>
                        </td>
                        <td className="py-2 px-3 text-right tabular-nums whitespace-nowrap">
                          {formatCurrency(Number(n.monto), n.moneda)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
