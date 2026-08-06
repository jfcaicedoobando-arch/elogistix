/**
 * Bloque de una moneda dentro del Estado de cuenta: encabezado de sección,
 * filas de factura (expandibles) y renglón de subtotales.
 */
import { Fragment } from "react";
import { TableCell } from "@/components/ui/table";
import { DetailTableRow } from "@/components/shared/DetailTable";
import { formatCurrency } from "@/lib/formatters";
import { EstadoCuentaRowExpanded } from "./EstadoCuentaRowExpanded";
import { EstadoCuentaFilaFactura } from "./EstadoCuentaFilaFactura";
import type { GrupoMoneda } from "../services/estadoCuentaAging";

interface Props {
  grupo: GrupoMoneda;
  mostrarEncabezado: boolean;
  expandidas: Set<string>;
  onToggle: (id: string) => void;
  facturaHref: (id: string) => string;
}

export function EstadoCuentaGrupoMoneda({
  grupo,
  mostrarEncabezado,
  expandidas,
  onToggle,
  facturaHref,
}: Props) {
  return (
    <Fragment>
      {mostrarEncabezado && (
        <DetailTableRow hoverable={false}>
          <TableCell colSpan={11} className="bg-muted/60 py-1.5 text-xs font-semibold uppercase tracking-wide">
            Movimientos en {grupo.moneda} · {grupo.filas.length} factura(s)
          </TableCell>
        </DetailTableRow>
      )}

      {grupo.filas.map((fila) => (
        <Fragment key={fila.id}>
          <EstadoCuentaFilaFactura
            fila={fila}
            abierta={expandidas.has(fila.id)}
            onToggle={onToggle}
            facturaHref={facturaHref}
          />
          {expandidas.has(fila.id) && (
            <DetailTableRow hoverable={false}>
              <TableCell colSpan={11} className="p-0">
                <EstadoCuentaRowExpanded factura={fila} />
              </TableCell>
            </DetailTableRow>
          )}
        </Fragment>
      ))}

      <DetailTableRow hoverable={false} className="border-t-2 bg-muted/30">
        <TableCell colSpan={6} className="text-xs font-semibold uppercase tracking-wide">
          Subtotal {grupo.moneda}
        </TableCell>
        <TableCell className="text-right tabular-nums font-semibold whitespace-nowrap">
          {formatCurrency(grupo.cargos, grupo.moneda)}
        </TableCell>
        <TableCell className="text-right tabular-nums font-semibold whitespace-nowrap text-success">
          {formatCurrency(grupo.abonos, grupo.moneda)}
        </TableCell>
        <TableCell className="text-right tabular-nums font-semibold whitespace-nowrap">
          {formatCurrency(grupo.saldo, grupo.moneda)}
        </TableCell>
        <TableCell colSpan={2} />
      </DetailTableRow>
    </Fragment>
  );
}
