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
import { Button } from "@/components/ui/button";
import { Hint } from "@/components/shared/Hint";

import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { formatCurrency, formatDate, toTitleCase } from "@/lib/formatters";
import { useNotasCreditoRecientes, type EstadoNotaCredito } from "@/features/facturacion/hooks";
import { EmptyStateInline } from "@/components/empty/EmptyStateInline";
import { Receipt } from "lucide-react";

import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { DetailTableHead } from "@/components/shared/DetailTable";
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
        <Button
          type="button"
          variant="ghost"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label="Mostrar u ocultar notas de crédito recientes"
          className="h-auto w-full flex items-center justify-between whitespace-normal rounded-none p-3 font-normal hover:bg-muted/30"
        >
          <div className="flex items-center gap-3">
            <span className="font-medium text-body">Notas de crédito recientes</span>
            <span className="text-body-sm text-muted-foreground">({data.length})</span>
            {Object.entries(totales).map(([mon, total]) => (
              <Badge key={mon} variant="outline" className="font-mono text-body-sm">
                {formatCurrency(total, mon)}
              </Badge>
            ))}
          </div>
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>

        {open && (
          <div className="border-t">
            <div className="p-3 flex flex-wrap gap-2 items-center">
              <Select value={estado} onValueChange={(v) => setEstado(v as EstadoNotaCredito | "todos")}>
                <SelectTrigger className="w-[150px] h-8 text-body-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ESTADOS.map((e) => <SelectItem key={e} value={e}>{e === "todos" ? "Todos los estados" : e}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={cliente} onValueChange={setCliente}>
                <SelectTrigger className="w-[220px] h-8 text-body-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los clientes</SelectItem>
                  {clientes.map((c) => <SelectItem key={c.id} value={c.id}>{toTitleCase(c.nombre)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {isLoading ? (
              <EmptyStateInline loading message="Cargando…" />
            ) : filtradas.length === 0 ? (
              <EmptyStateInline icon={Receipt} message="No hay notas de crédito que coincidan." className="py-4" />
            ) : (
              <div className="overflow-x-auto">
                <Table className="w-full text-body">
                  <TableHeader className="text-body-sm text-muted-foreground border-y bg-muted/20">
                    <TableRow>
                      <DetailTableHead>Folio</DetailTableHead>
                      <DetailTableHead>Factura</DetailTableHead>
                      <DetailTableHead>Cliente</DetailTableHead>
                      <DetailTableHead>Fecha</DetailTableHead>
                      <DetailTableHead>Motivo</DetailTableHead>
                      <DetailTableHead>Estado</DetailTableHead>
                      <DetailTableHead className="text-right">Monto</DetailTableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtradas.map((n) => (
                      <TableRow
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
                        <TableCell className="font-mono text-body-sm whitespace-nowrap">{n.folio}</TableCell>
                        <TableCell className="whitespace-nowrap font-mono text-body-sm">
                          {n.factura_numero}
                        </TableCell>
                        <Hint label={toTitleCase(n.cliente_nombre)}>
                          <TableCell className="max-w-[200px] truncate">
                            {toTitleCase(n.cliente_nombre)}
                          </TableCell>
                        </Hint>
                        <TableCell className="text-body-sm whitespace-nowrap">{formatDate(n.fecha_emision)}</TableCell>
                        <TableCell className="text-body-sm">{n.motivo}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={ESTADO_COLOR[n.estado]}>{n.estado}</Badge>
                        </TableCell>
                        <TableCell className="text-right tabular-nums whitespace-nowrap">
                          {formatCurrency(Number(n.monto), n.moneda)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
