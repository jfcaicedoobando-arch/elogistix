/**
 * Tab Captura: grid editable categorías × 12 meses con upsert por celda.
 */
import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { CardSkeleton } from "@/components/shared/skeletons";
import { Input } from "@/components/ui/input";
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
      const err = e as { message?: string };
      notifyError(undefined, { title: err.message ?? "Error al guardar", error: e, method: "FEATURES_PRESUPUESTO_COMPONENTS_TABCAPTURA_2" });
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
          <p className="text-xs text-muted-foreground ml-3">
            Captura el presupuesto mensual por categoría. Autosave al salir del campo.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-2 py-2 text-left sticky left-0 bg-muted/80">Categoría</th>
                {MESES_LABEL.map((m) => <th key={m} className="px-2 py-2 text-right">{m}</th>)}
                <th className="px-2 py-2 text-right">Total año</th>
              </tr>
            </thead>
            <tbody>
              {(cats.data ?? []).map((c, i) => {
                const totalRow = MESES_LABEL.reduce((acc, _, mi) => {
                  const periodo = `${anio}-${String(mi + 1).padStart(2, "0")}`;
                  return acc + (matriz.get(`${c.id}|${periodo}`) ?? 0);
                }, 0);
                return (
                  <tr key={c.id} className={`border-t ${i % 2 === 1 ? "bg-muted/20" : ""}`}>
                    <td className="px-2 py-1 font-medium sticky left-0 bg-inherit">{c.nombre}</td>
                    {MESES_LABEL.map((_, mi) => {
                      const periodo = `${anio}-${String(mi + 1).padStart(2, "0")}`;
                      const key = `${c.id}|${periodo}`;
                      const stored = matriz.get(key) ?? 0;
                      const val = draft[key] ?? (stored === 0 ? "" : String(stored));
                      return (
                        <td key={mi} className="px-1 py-1">
                          <Input
                            type="number" step="100" min={0}
                            className="h-7 text-right tabular-nums px-1"
                            value={val}
                            onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
                            onBlur={(e) => handleBlur(c.id, periodo, e.target.value || "0")}
                          />
                        </td>
                      );
                    })}
                    <td className="px-2 py-1 text-right font-semibold tabular-nums">{formatCurrency(totalRow, "MXN")}</td>
                  </tr>
                );
              })}
              <tr className="border-t bg-muted/50 font-semibold">
                <td className="px-2 py-2 sticky left-0 bg-muted/80">Total mes</td>
                {totalesCol.map((t, i) => (
                  <td key={i} className="px-2 py-2 text-right tabular-nums">{formatCurrency(t, "MXN")}</td>
                ))}
                <td className="px-2 py-2 text-right tabular-nums">
                  {formatCurrency(totalesCol.reduce((a, b) => a + b, 0), "MXN")}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
