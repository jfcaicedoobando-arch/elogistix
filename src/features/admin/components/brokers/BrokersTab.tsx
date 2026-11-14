import { useState } from "react";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CargaGuard } from "@/components/shared/states/CargaGuard";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useBrokers } from "@/features/admin/hooks/useBrokers";
import NuevoBrokerDialog from "./NuevoBrokerDialog";
import PorcentajesBrokerDialog from "./PorcentajesBrokerDialog";
import { BrokersComisiones } from "./BrokersComisiones";
import type { BrokerFila } from "@/features/admin/services/brokers";

const pctFmt = new Intl.NumberFormat("es-MX", { maximumFractionDigits: 2 });

export function BrokersTab() {
  const [open, setOpen] = useState(false);
  const [editar, setEditar] = useState<BrokerFila | null>(null);
  const q = useBrokers();
  const brokers = q.data ?? [];

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button onClick={() => setOpen(true)}>
          <UserPlus className="h-4 w-4" />
          Crear broker nuevo
        </Button>
      </div>
      <NuevoBrokerDialog open={open} onOpenChange={setOpen} />
      <CargaGuard
        isLoading={q.isLoading}
        isError={q.isError}
        onRetry={q.refetch}
        errorTitle="No se pudo cargar el listado de brokers"
        errorDescription="Revisa tu conexión y vuelve a intentar."
      >
        {brokers.length === 0 ? (
          <p className="text-body-sm text-muted-foreground">Todavía no hay brokers dados de alta.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Correo</TableHead>
                <TableHead className="text-right">% broker</TableHead>
                <TableHead className="text-right">% KAM</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {brokers.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="font-medium">{b.nombre}</TableCell>
                  <TableCell>{b.email}</TableCell>
                  <TableCell className="text-right tabular-nums">{pctFmt.format(Number(b.comision_pct))}%</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {b.comision_kam_pct == null ? "Normal" : `${pctFmt.format(Number(b.comision_kam_pct))}%`}
                  </TableCell>
                  <TableCell>
                    <Badge variant={b.activo ? "secondary" : "outline"}>{b.activo ? "Activo" : "Inactivo"}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => setEditar(b)}>Porcentajes</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CargaGuard>
      {editar && <PorcentajesBrokerDialog broker={editar} onClose={() => setEditar(null)} />}
      <BrokersComisiones />
    </div>
  );
}
