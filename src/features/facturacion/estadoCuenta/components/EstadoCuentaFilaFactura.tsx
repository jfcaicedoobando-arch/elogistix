/**
 * Fila de factura del Estado de cuenta (una línea del statement).
 */
import { Link } from "react-router-dom";
import { TableCell } from "@/components/ui/table";
import { DetailTableRow } from "@/components/shared/DetailTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency, formatDate } from "@/lib/formatters";
import type { EstatusCobranza } from "../services/estadoCuenta";
import type { FilaEstadoCuenta } from "../services/estadoCuentaAging";

const ESTADO_CUENTA_COLSPAN = 11;

const BADGE: Record<EstatusCobranza, "outline" | "warning" | "destructive" | "secondary"> = {
  Vigente: "outline",
  "Por vencer": "warning",
  Vencida: "destructive",
  Pagada: "secondary",
  "Sin saldo": "secondary",
};

interface Props {
  fila: FilaEstadoCuenta;
  abierta: boolean;
  onToggle: (id: string) => void;
  facturaHref: (id: string) => string;
}

export function EstadoCuentaFilaFactura({ fila, abierta, onToggle, facturaHref }: Props) {
  const abono = fila.pagado + fila.notas_credito_aplicadas;
  const vencida = fila.estatus_cobranza === "Vencida";

  return (
    <DetailTableRow className={cn(vencida && "bg-destructive/5")}>
      <TableCell className="px-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => onToggle(fila.id)}
          aria-label={abierta ? "Colapsar" : "Expandir"}
          aria-expanded={abierta}
        >
          {abierta ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </Button>
      </TableCell>
      <TableCell className="tabular-nums whitespace-nowrap">
        {formatDate(fila.fecha_emision)}
      </TableCell>
      <TableCell>
        <Button variant="link" size="sm" asChild className="h-auto p-0 font-medium tabular-nums">
          <Link to={facturaHref(fila.id)}>{fila.numero}</Link>
        </Button>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2 text-sm">
          <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate" title={`Factura · Exp. ${fila.expediente}`}>
            Exp. {fila.expediente}
          </span>
        </div>
      </TableCell>
      <TableCell className="tabular-nums whitespace-nowrap text-muted-foreground">
        {formatDate(fila.fecha_vencimiento)}
      </TableCell>
      <TableCell
        className={cn("text-right tabular-nums", vencida ? "text-destructive font-medium" : "text-muted-foreground")}
      >
        {fila.dias_vencido > 0 ? fila.dias_vencido : "—"}
      </TableCell>
      <TableCell className="text-right tabular-nums whitespace-nowrap">
        {formatCurrency(fila.total, fila.moneda)}
      </TableCell>
      <TableCell className="text-right tabular-nums whitespace-nowrap text-success">
        {abono > 0 ? formatCurrency(abono, fila.moneda) : "—"}
      </TableCell>
      <TableCell
        className={cn(
          "text-right tabular-nums font-semibold whitespace-nowrap",
          vencida && "text-destructive",
        )}
      >
        {formatCurrency(fila.saldo, fila.moneda)}
      </TableCell>
      <TableCell className="hidden text-right tabular-nums whitespace-nowrap text-muted-foreground 2xl:table-cell">
        {formatCurrency(fila.saldoAcumulado, fila.moneda)}
      </TableCell>
      <TableCell>
        <Badge variant={BADGE[fila.estatus_cobranza]}>{fila.estatus_cobranza}</Badge>
      </TableCell>
    </DetailTableRow>
  );
}
