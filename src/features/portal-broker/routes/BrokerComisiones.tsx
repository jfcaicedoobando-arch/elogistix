/** Portal de Brokers · Comisiones: totales y estatus de cada comisión (sólo lectura). */
import { Wallet } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { CargaGuard } from "@/components/shared/states/CargaGuard";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useDocumentTitle } from "@/hooks/shared";
import { formatCurrency } from "@/lib/formatters/numbers";
import { formatDate } from "@/lib/formatters/dates";
import { estatusVisible, totalesComisiones } from "../domain/totalesComisiones";
import { useMisComisionesBroker } from "../hooks/useBrokerPortal";

function Total({ label, monto }: { label: string; monto: number }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-body-sm text-muted-foreground">{label}</p>
        <p className="text-h4 tabular-nums">{formatCurrency(monto, "MXN")}</p>
      </CardContent>
    </Card>
  );
}

export default function BrokerComisiones() {
  useDocumentTitle("Mis comisiones");
  const q = useMisComisionesBroker();
  const filas = q.data ?? [];
  const t = totalesComisiones(filas);

  return (
    <div className="space-y-4">
      <PageHeader
        icon={<Wallet className="h-6 w-6 text-primary" />}
        title="Mis comisiones"
        description="Se ganan cuando el cliente paga, sobre la utilidad real del embarque."
      />
      <CargaGuard isLoading={q.isLoading} isError={q.isError} onRetry={q.refetch}
        errorTitle="No se pudieron cargar tus comisiones" errorDescription="Revisa tu conexión y vuelve a intentar.">
        <div className="grid gap-3 sm:grid-cols-3">
          <Total label="Pendiente (devengada)" monto={t.pendiente} />
          <Total label="Liquidada por pagar" monto={t.liquidado} />
          <Total label="Pagada" monto={t.pagado} />
        </div>
        {filas.length === 0 ? (
          <p className="text-body-sm text-muted-foreground">Aún no tienes comisiones.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Factura</TableHead>
                <TableHead className="text-right">%</TableHead>
                <TableHead className="text-right">Comisión</TableHead>
                <TableHead>Estatus</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filas.map((f) => (
                <TableRow key={f.id}>
                  <TableCell>{formatDate(f.fecha)}</TableCell>
                  <TableCell>{f.empresa}<span className="block text-body-sm text-muted-foreground">{f.organizacion}</span></TableCell>
                  <TableCell>{f.factura || "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{Number(f.porcentaje)}%</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(Number(f.comision_mxn), "MXN")}</TableCell>
                  <TableCell><Badge variant="outline">{estatusVisible(f)}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CargaGuard>
    </div>
  );
}
