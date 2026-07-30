/**
 * Bloque de una moneda dentro del Estado de cuenta: encabezado de sección,
 * filas de factura (expandibles) y renglón de subtotales.
 */
import { Fragment } from "react";
import { TableCell, TableRow } from "@/components/ui/table";
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
        <TableRow className="hover:bg-transparent">
          <TableCell colSpan={11} className="bg-muted/60 py-1.5 text-xs font-semibold uppercase tracking-wide">
            Movimientos en {grupo.moneda} · {grupo.filas.length} factura(s)
          </TableCell>
        </TableRow>
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
            <TableRow>
              <TableCell colSpan={11} className="p-0">
                <EstadoCuentaRowExpanded factura={fila} />
              </TableCell>
            </TableRow>
          )}
        </Fragment>
      ))}

      <TableRow className="border-t-2 bg-muted/30 hover:bg-muted/30">
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
      </TableRow>
    </Fragment>
  );
}
