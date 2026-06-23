/**
 * Embarques donde el agente autenticado figura como agente de carga.
 * Sólo lectura, sin datos comerciales (RLS lo restringe a esta vista mínima).
 */
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/shared/PageHeader";
import { useAgenteEmbarques } from "@/features/portal-agente/hooks";

export default function AgenteEmbarques() {
  const { data: embarques = [], isLoading } = useAgenteEmbarques();
  return (
    <div className="space-y-4">
      <PageHeader
        title="Mis embarques"
        description="Embarques donde figuras como agente de carga. Sólo lectura — sin datos comerciales del cliente final."
      />

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Expediente</TableHead>
              <TableHead>Modo</TableHead>
              <TableHead>Ruta</TableHead>
              <TableHead>BL Master</TableHead>
              <TableHead>ETD</TableHead>
              <TableHead>ETA</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Cargando…</TableCell></TableRow>
            )}
            {!isLoading && embarques.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-6">
                  Aún no hay embarques asignados a tu agente.
                </TableCell>
              </TableRow>
            )}
            {embarques.map((e) => (
              <TableRow key={e.id}>
                <TableCell className="font-medium">{e.expediente}</TableCell>
                <TableCell className="text-xs">{e.modo}</TableCell>
                <TableCell className="text-xs">
                  {(e.puerto_origen ?? "—")} → {(e.puerto_destino ?? "—")}
                </TableCell>
                <TableCell className="text-xs font-mono">{e.bl_master ?? "—"}</TableCell>
                <TableCell className="text-xs">{e.etd ?? "—"}</TableCell>
                <TableCell className="text-xs">{e.eta ?? "—"}</TableCell>
                <TableCell><Badge variant="outline">{e.estado}</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
