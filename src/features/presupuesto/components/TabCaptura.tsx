/**
 * Tab Captura: grid editable categorías × 12 meses con upsert por celda.
 *
 * Excepción documentada al guardrail `no-raw-table` (Ola F, punto 8): grid
 * de inputs editables por celda (categoría × mes) con columna y fila de
 * totales sticky — patrón no soportado por `<DataTable />`. Se homologa
 * usando `Table`/`TableHeader`/`TableBody` (de `ui/table`) en vez de un
 * `<table>` crudo, para compartir estilos base con el resto del ERP.
 */
import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { CardSkeleton } from "@/components/shared/skeletons";
import { Input } from "@/components/ui/input";
import { Table, TableHeader, TableBody, TableCell } from "@/components/ui/table";
import { DetailTableHead, DetailTableRow } from "@/components/shared/DetailTable";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useOrganization } from "@/lib/contexts/OrganizationContext";
import {
  usePresupuestoCategorias,
  usePresupuestoMensualAnio,
  useUpsertCeldaPresupuesto,
} from "@/features/presupuesto/hooks";
import { formatCurrency } from "@/lib/formatters/numbers";

import { notifyError } from "@/lib/ui/appFeedback";
import { getErrorMessage } from "@/lib/errors";
const MESES_LABEL = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

interface Props { anio: number; onAnioChange: (a: number) => void }

export function TabCaptura({ anio, onAnioChange }: Props) {
  const { user } = useAuth();
  const { organizationId } = useOrganization();
  const cats = usePresupuestoCategorias(true);
  const presup = usePresupuestoMensualAnio(anio);
  const upsert = useUpsertCeldaPresupuesto();

  const matriz = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of presup.data ?? []) {
      map.set(`${r.categoria_id}|${r.periodo}`, Number(r.monto_mxn));
    }
    return map;
  }, [presup.data]);

  const [draft, setDraft] = useState<Record<string, string>>({});

  if (cats.isLoading || presup.isLoading) {
    return <CardSkeleton lines={8} />;
  }

  const handleBlur = async (categoria_id: string, periodo: string, raw: string) => {
    if (!organizationId) return;
    const monto = Number(raw);
    if (Number.isNaN(monto) || monto < 0) {
      notifyError(undefined, { title: "Monto inválido", method: "FEATURES_PRESUPUESTO_COMPONENTS_TABCAPTURA_1" });
      return;
    }
    const key = `${categoria_id}|${periodo}`;
    if (matriz.get(key) === monto) return; // sin cambio
    try {
      await upsert.mutateAsync({
        categoria_id, periodo, monto_mxn: monto,
        organization_id: organizationId, creado_por: user?.id ?? null,
      });
      setDraft((d) => { const n = { ...d }; delete n[key]; return n; });
    } catch (e) {
      notifyError(undefined, { title: "No se pudo guardar el presupuesto", description: getErrorMessage(e), error: e, method: "FEATURES_PRESUPUESTO_COMPONENTS_TABCAPTURA_2" });
    }
  };

  const totalesCol = MESES_LABEL.map((_, i) => {
    const periodo = `${anio}-${String(i + 1).padStart(2, "0")}`;
    return (cats.data ?? []).reduce((acc, c) => acc + (matriz.get(`${c.id}|${periodo}`) ?? 0), 0);
  });

  return (
    <Card>
      <CardContent className="p-3 space-y-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => onAnioChange(anio - 1)}>◀</Button>
          <span className="font-semibold w-16 text-center">{anio}</span>
          <Button variant="outline" size="sm" onClick={() => onAnioChange(anio + 1)}>▶</Button>
          <p className="text-body-sm text-muted-foreground ml-3">
            Captura el presupuesto mensual por categoría. Autosave al salir del campo.
          </p>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <DetailTableRow hoverable={false}>
                <DetailTableHead className="sticky left-0 bg-muted/80">Categoría</DetailTableHead>
                {MESES_LABEL.map((m) => <DetailTableHead key={m} className="text-right">{m}</DetailTableHead>)}
                <DetailTableHead className="text-right">Total año</DetailTableHead>
              </DetailTableRow>
            </TableHeader>
            <TableBody>
              {(cats.data ?? []).map((c, i) => {
                const totalRow = MESES_LABEL.reduce((acc, _, mi) => {
                  const periodo = `${anio}-${String(mi + 1).padStart(2, "0")}`;
                  return acc + (matriz.get(`${c.id}|${periodo}`) ?? 0);
                }, 0);
                return (
                  <DetailTableRow key={c.id} className={i % 2 === 1 ? "bg-muted/20" : undefined}>
                    <TableCell className="py-1 font-medium sticky left-0 bg-inherit">{c.nombre}</TableCell>
                    {MESES_LABEL.map((_, mi) => {
                      const periodo = `${anio}-${String(mi + 1).padStart(2, "0")}`;
                      const key = `${c.id}|${periodo}`;
                      const stored = matriz.get(key) ?? 0;
                      const val = draft[key] ?? (stored === 0 ? "" : String(stored));
                      return (
                        <TableCell key={mi} className="p-1">
                          <Input
                            type="number" step="100" min={0}
                            aria-label={`Monto de ${c.nombre} para ${periodo}`}
                            className="h-7 text-right tabular-nums px-1"
                            value={val}
                            onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
                            onBlur={(e) => handleBlur(c.id, periodo, e.target.value || "0")}
                          />
                        </TableCell>
                      );
                    })}
                    <TableCell className="py-1 text-right font-semibold tabular-nums">{formatCurrency(totalRow, "MXN")}</TableCell>
                  </DetailTableRow>
                );
              })}
              <DetailTableRow hoverable={false} className="bg-muted/50 font-semibold">
                <TableCell className="sticky left-0 bg-muted/80">Total mes</TableCell>
                {totalesCol.map((t, i) => (
                  <TableCell key={i} className="text-right tabular-nums">{formatCurrency(t, "MXN")}</TableCell>
                ))}
                <TableCell className="text-right tabular-nums">
                  {formatCurrency(totalesCol.reduce((a, b) => a + b, 0), "MXN")}
                </TableCell>
              </DetailTableRow>
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
