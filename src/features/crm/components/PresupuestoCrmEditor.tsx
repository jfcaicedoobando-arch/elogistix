/**
 * Editor del presupuesto comercial mensual de la organización (Etapa 3).
 */
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useOrganization } from "@/lib/contexts/OrganizationContext";
import { formatCurrency } from "@/lib/formatters/numbers";
import { usePresupuestoCrm, useGuardarPresupuestoMes } from "@/features/crm/hooks/useHigienePipeline";

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export default function PresupuestoCrmEditor() {
  const { organizationId } = useOrganization();
  const [anio, setAnio] = useState(() => new Date().getFullYear());
  const { data = [], isLoading } = usePresupuestoCrm(anio);
  const guardar = useGuardarPresupuestoMes();
  const [borrador, setBorrador] = useState<Record<number, string>>({});

  const totalAnual = useMemo(
    () => data.reduce((acc, fila) => acc + Number(fila.monto ?? 0), 0),
    [data],
  );

  const montoDe = (mes: number) => {
    if (borrador[mes] !== undefined) return borrador[mes];
    const fila = data.find((f) => f.mes === mes);
    return fila ? String(fila.monto) : "";
  };

  const handleGuardar = async (mes: number) => {
    if (!organizationId) return;
    const monto = Number(borrador[mes] ?? montoDe(mes)) || 0;
    await guardar.mutateAsync({ organizationId, anio, mes, monto, moneda: "MXN" });
    setBorrador((b) => {
      const next = { ...b };
      delete next[mes];
      return next;
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-end gap-3">
        <div className="space-y-1">
          <Label>Año</Label>
          <Input
            type="number"
            className="w-28"
            value={anio}
            onChange={(e) => setAnio(Number(e.target.value) || anio)}
          />
        </div>
        <p className="text-sm text-muted-foreground pb-2">
          Total anual capturado: <span className="font-medium">{formatCurrency(totalAnual)}</span>
        </p>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Mes</TableHead>
            <TableHead className="text-right">Presupuesto (MXN)</TableHead>
            <TableHead className="w-28" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {MESES.map((nombre, i) => {
            const mes = i + 1;
            return (
              <TableRow key={mes}>
                <TableCell>{nombre}</TableCell>
                <TableCell className="text-right">
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    className="text-right"
                    disabled={isLoading}
                    value={montoDe(mes)}
                    onChange={(e) => setBorrador((b) => ({ ...b, [mes]: e.target.value }))}
                  />
                </TableCell>
                <TableCell>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={borrador[mes] === undefined}
                    onClick={() => handleGuardar(mes)}
                  >
                    Guardar
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
