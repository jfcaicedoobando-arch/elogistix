/**
 * Tabla "Desglose por proveedor" del bloque P&L.
 * Extraída de `TabPnl.tsx` en v13.56.2 (auditoría — paso 5).
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { DetailTableHead, DetailTableRow, DetailTableEmptyRow } from "@/components/shared/DetailTable";
import { fmtPnl } from "@/lib/formatters/pnl";
import type { PnlPorProveedor } from "@/features/embarques/services/pnlFinanciero";

interface Props {
  proveedores: PnlPorProveedor[];
}

export function PnlProveedoresTable({ proveedores }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Desglose por proveedor</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <DetailTableHead>Proveedor</DetailTableHead>
              <DetailTableHead className="text-right">Presupuestado</DetailTableHead>
              <DetailTableHead className="text-right">Facturado</DetailTableHead>
              <DetailTableHead className="text-right"># Facturas</DetailTableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
{proveedores.length === 0 && (
              <DetailTableEmptyRow colSpan={4} message="Sin proveedores" />
            )}
            {proveedores.map((p) => (
              <DetailTableRow key={`${p.proveedor_id ?? "na"}-${p.proveedor_nombre}`}>
                <TableCell>{p.proveedor_nombre}</TableCell>
                <TableCell className="text-right tabular-nums">{fmtPnl(p.presupuestado_mxn)}</TableCell>
                <TableCell className="text-right tabular-nums">{fmtPnl(p.real_mxn)}</TableCell>
                <TableCell className="text-right tabular-nums">{p.facturas_count}</TableCell>
              </DetailTableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
