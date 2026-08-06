/**
 * Tabla "Desglose por proveedor" del bloque P&L.
 * Extraída de `TabPnl.tsx` en v13.56.2 (auditoría — paso 5).
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
              <TableHead>Proveedor</TableHead>
              <TableHead className="text-right">Presupuestado</TableHead>
              <TableHead className="text-right">Facturado</TableHead>
              <TableHead className="text-right"># Facturas</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {proveedores.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">Sin proveedores</TableCell>
              </TableRow>
            )}
            {proveedores.map((p) => (
              <TableRow key={`${p.proveedor_id ?? "na"}-${p.proveedor_nombre}`}>
                <TableCell>{p.proveedor_nombre}</TableCell>
                <TableCell className="text-right tabular-nums">{fmtPnl(p.presupuestado_mxn)}</TableCell>
                <TableCell className="text-right tabular-nums">{fmtPnl(p.real_mxn)}</TableCell>
                <TableCell className="text-right tabular-nums">{p.facturas_count}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
