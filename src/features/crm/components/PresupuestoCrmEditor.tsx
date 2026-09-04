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
  // El borrador se indexa por "anio-mes" para que un valor capturado en un año
  // no se persista en otro si el usuario cambia el año antes de guardar.
  const [borrador, setBorrador] = useState<Record<string, string>>({});
  const claveBorrador = (a: number, mes: number) => `${a}-${mes}`;

  // UI-15: la tabla admite MXN/USD/EUR; si hay monedas mezcladas se muestra un
  // total por moneda en vez de una sola cifra rotulada como pesos.
  const totalesPorMoneda = useMemo(() => {
    const acc = new Map<string, number>();
    for (const fila of data) {
      const moneda = (fila.moneda ?? "MXN").toUpperCase();
      acc.set(moneda, (acc.get(moneda) ?? 0) + Number(fila.monto ?? 0));
    }
    return [...acc.entries()];
  }, [data]);

  const totalAnualTexto = totalesPorMoneda.length === 0
    ? formatCurrency(0, "MXN")
    : totalesPorMoneda.map(([moneda, monto]) => formatCurrency(monto, moneda)).join(" · ");

  const montoDe = (mes: number) => {
    const valor = borrador[claveBorrador(anio, mes)];
    if (valor !== undefined) return valor;
    const fila = data.find((f) => f.mes === mes);
    return fila ? String(fila.monto) : "";
  };

  const handleGuardar = async (mes: number) => {
    if (!organizationId) return;
    const clave = claveBorrador(anio, mes);
    const monto = Number(borrador[clave] ?? montoDe(mes)) || 0;
    await guardar.mutateAsync({ organizationId, anio, mes, monto, moneda: "MXN" });
    setBorrador((b) => {
      const next = { ...b };
      delete next[clave];
      return next;
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor="presupuesto-anio">Año</Label>
          <Input
            id="presupuesto-anio"
            type="number"
            className="w-28"
            value={anio}
            onChange={(e) => setAnio(Number(e.target.value) || anio)}
          />
        </div>
        <p className="text-body text-muted-foreground pb-2">
          Total anual capturado: <span className="font-medium">{totalAnualTexto}</span>
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
                    aria-label={`Presupuesto de ${nombre}`}
                    disabled={isLoading}
                    value={montoDe(mes)}
                    onChange={(e) => setBorrador((b) => ({ ...b, [claveBorrador(anio, mes)]: e.target.value }))}
                  />
                </TableCell>
                <TableCell>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={borrador[claveBorrador(anio, mes)] === undefined}
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
