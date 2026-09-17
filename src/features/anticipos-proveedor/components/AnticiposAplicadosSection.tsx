import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAplicacionesPorFactura } from "../hooks/useAplicacionesPorFactura";
import { formatCurrency } from "@/lib/formatters";
import { formatDate } from "@/lib/formatters/dates";
import { ListSkeleton } from "@/components/shared/states/ListSkeleton";
import { subtotalesPorMoneda } from "../domain/totalesAplicaciones";

import { Table, TableBody, TableCell, TableFooter, TableHeader, TableRow } from "@/components/ui/table";
import { DetailTableHead } from "@/components/shared/DetailTable";
interface Props {
  facturaId: string;
}

export function AnticiposAplicadosSection({ facturaId }: Props) {
  const { data: aplicaciones = [], isLoading } = useAplicacionesPorFactura(facturaId);

  if (isLoading) return <ListSkeleton rows={2} />;
  if (aplicaciones.length === 0) return null;

  // No se suman monedas distintas: un subtotal por cada moneda aplicada.
  const subtotales = subtotalesPorMoneda(aplicaciones);

  return (
    <Card>
      <CardHeader className="py-4">
        <CardTitle>Anticipos aplicados</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table className="w-full text-sm">
            <TableHeader className="bg-muted/40 text-label uppercase tracking-wider text-muted-foreground">
              <TableRow>
                <DetailTableHead>Fecha Aplicación</DetailTableHead>
                <DetailTableHead className="text-right">Monto Aplicado</DetailTableHead>
                <DetailTableHead className="text-center">Moneda</DetailTableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-border">
              {aplicaciones.map((app) => (
                <TableRow key={app.id}>
                  <TableCell className="whitespace-nowrap">
                    {formatDate(app.fecha_aplicacion)}
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap font-medium">
                    {formatCurrency(app.monto_aplicado, app.moneda_aplicada)}
                  </TableCell>
                  <TableCell className="text-center whitespace-nowrap">
                    {app.moneda_aplicada}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter className="bg-muted/40 font-medium">
              {subtotales.map((s) => (
                <TableRow key={s.moneda}>
                  <TableCell>Total aplicado en {s.moneda}</TableCell>
                  <TableCell className="text-right whitespace-nowrap tabular-nums">
                    {formatCurrency(s.total, s.moneda)}
                  </TableCell>
                  <TableCell className="text-center">{s.moneda}</TableCell>
                </TableRow>
              ))}
            </TableFooter>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
