import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAplicacionesPorFactura } from "../hooks/useAplicacionesPorFactura";
import { formatCurrency } from "@/lib/formatters";
import { formatDate } from "@/lib/formatters/dates";
import { ListSkeleton } from "@/components/shared/states/ListSkeleton";

interface Props {
  facturaId: string;
}

export function AnticiposAplicadosSection({ facturaId }: Props) {
  const { data: aplicaciones = [], isLoading } = useAplicacionesPorFactura(facturaId);

  if (isLoading) return <ListSkeleton rows={2} />;
  if (aplicaciones.length === 0) return null;

  return (
    <Card>
      <CardHeader className="py-4">
        <CardTitle>Anticipos aplicados</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-label uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3 font-bold">Fecha Aplicación</th>
                <th className="text-right px-4 py-3 font-bold">Monto Aplicado</th>
                <th className="text-center px-4 py-3 font-bold">Moneda</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {aplicaciones.map((app) => (
                <tr key={app.id}>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {formatDate(app.fecha_aplicacion)}
                  </td>
                  <td className="text-right px-4 py-3 whitespace-nowrap font-medium">
                    {formatCurrency(app.monto_aplicado, app.moneda_aplicada)}
                  </td>
                  <td className="text-center px-4 py-3 whitespace-nowrap">
                    {app.moneda_aplicada}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
