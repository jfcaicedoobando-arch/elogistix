/**
 * Tabla de movimientos del Estado de Cuenta.
 * Filas colapsables: cada factura expone pagos y notas de crédito anidados.
 * Usa `<Table>` de shadcn (misma base que DataTable) — el componente DataTable
 * genérico no soporta sub-rows nativamente, así que se compone aquí de forma
 * localizada y sin duplicar formateadores (todo pasa por `@/lib/formatters`).
 */
import { useState, Fragment } from "react";
import { Link } from "react-router-dom";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, FileText, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency, formatDate } from "@/lib/formatters";
import type { EstatusCobranza, FacturaEstadoCuenta } from "../services/estadoCuenta";
import { EstadoCuentaRowExpanded } from "./EstadoCuentaRowExpanded";

interface Props {
  rows: FacturaEstadoCuenta[];
  isLoading?: boolean;
  facturaHref: (facturaId: string) => string;
}

const estatusBadgeVariant: Record<EstatusCobranza, "default" | "destructive" | "secondary" | "outline"> = {
  Vigente: "outline",
  "Por vencer": "secondary",
  Vencida: "destructive",
  Pagada: "default",
  "Sin saldo": "default",
};

export function EstadoCuentaTable({ rows, isLoading, facturaHref }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (!isLoading && rows.length === 0) {
    return (
      <div className="border rounded-lg py-16 text-center bg-card">
        <Inbox className="mx-auto h-10 w-10 text-muted-foreground/50 mb-2" />
        <p className="text-sm text-muted-foreground">
          Sin movimientos en el rango seleccionado.
        </p>
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10" />
            <TableHead>Fecha</TableHead>
            <TableHead>Folio</TableHead>
            <TableHead>Concepto</TableHead>
            <TableHead className="text-right">Cargo</TableHead>
            <TableHead className="text-right">Abono</TableHead>
            <TableHead className="text-right">Saldo insoluto</TableHead>
            <TableHead>Estatus</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={`sk-${i}`}>
                <TableCell colSpan={8}>
                  <div className="h-6 bg-muted animate-pulse rounded" />
                </TableCell>
              </TableRow>
            ))
          ) : (
            rows.map((f) => {
              const isOpen = expanded.has(f.id);
              const abono = f.pagado + f.notas_credito_aplicadas;
              const vencida = f.estatus_cobranza === "Vencida";
              return (
                <Fragment key={f.id}>
                  <TableRow className={cn(vencida && "bg-destructive/5")}>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => toggle(f.id)}
                        aria-label={isOpen ? "Colapsar" : "Expandir"}
                        aria-expanded={isOpen}
                      >
                        {isOpen ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </Button>
                    </TableCell>
                    <TableCell className="tabular-nums whitespace-nowrap">
                      {formatDate(f.fecha_emision)}
                    </TableCell>
                    <TableCell>
                      <Link
                        to={facturaHref(f.id)}
                        className="text-primary hover:underline font-medium tabular-nums"
                      >
                        {f.numero}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-sm">
                        <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="truncate">
                          Factura · Exp. {f.expediente}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(f.total, f.moneda)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-success">
                      {abono > 0 ? formatCurrency(abono, f.moneda) : "—"}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right tabular-nums font-semibold",
                        vencida && "text-destructive",
                      )}
                    >
                      {formatCurrency(f.saldo, f.moneda)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={estatusBadgeVariant[f.estatus_cobranza]}>
                        {f.estatus_cobranza}
                      </Badge>
                    </TableCell>
                  </TableRow>
                  {isOpen && (
                    <TableRow>
                      <TableCell colSpan={8} className="p-0">
                        <EstadoCuentaRowExpanded factura={f} />
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
