import { ChevronLeft, ChevronRight, Calendar, Download, Info } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyStateInline } from "@/components/empty/EmptyStateInline";
import { formatCurrency } from "@/lib/formatters";
import { useEstadoResultados } from "@/hooks/profit";
import { MODOS_COLUMNAS, type EstadoResultados, type FilaER, type ModoColumna } from "@/lib/domain/estadoResultados";
import { exportToCsv } from "@/generators/exportCsv";

const CSV_HEADERS = [
  { key: "seccion", label: "Sección" },
  { key: "concepto", label: "Concepto" },
  { key: "maritimo", label: "Marítimo" },
  { key: "aereo", label: "Aéreo" },
  { key: "terrestre", label: "Terrestre" },
  { key: "total", label: "Total" },
] as const;

function fmt(n: number): string {
  if (n === 0) return "—";
  return formatCurrency(n, "MXN");
}

function pct(n: number): string {
  return `${n.toFixed(1)}%`;
}

function Row({ label, fila, bold = false }: { label: string; fila: { porModo: Record<ModoColumna, number>; total: number }; bold?: boolean }) {
  const cls = bold ? "font-semibold" : "";
  return (
    <tr className={`${cls} border-b`}>
      <td className="py-2 px-3 pl-6">{label}</td>
      {MODOS_COLUMNAS.map((m) => (
        <td key={m} className="py-2 px-3 text-right tabular-nums">{fmt(fila.porModo[m])}</td>
      ))}
      <td className="py-2 px-3 text-right tabular-nums">{fmt(fila.total)}</td>
    </tr>
  );
}

function SectionHeader({ label }: { label: string }) {
  return (
    <tr className="bg-primary/5 border-b border-t">
      <td colSpan={5} className="py-2 px-3 text-xs font-bold uppercase tracking-wider text-primary">
        {label}
      </td>
    </tr>
  );
}

function TotalRow({ label, valores, variant = "muted" }: { label: string; valores: { porModo: Record<ModoColumna, number>; total: number }; variant?: "muted" | "primary" }) {
  const bg = variant === "primary" ? "bg-primary/10" : "bg-muted";
  return (
    <tr className={`${bg} font-bold border-b`}>
      <td className="py-2.5 px-3">{label}</td>
      {MODOS_COLUMNAS.map((m) => (
        <td key={m} className="py-2.5 px-3 text-right tabular-nums">{fmt(valores.porModo[m])}</td>
      ))}
      <td className="py-2.5 px-3 text-right tabular-nums">{fmt(valores.total)}</td>
    </tr>
  );
}

function MargenRow({ margen }: { margen: EstadoResultados["margen"] }) {
  return (
    <tr className="bg-muted/60 font-semibold text-sm">
      <td className="py-2 px-3">Margen %</td>
      {MODOS_COLUMNAS.map((m) => (
        <td key={m} className="py-2 px-3 text-right tabular-nums">{pct(margen[m])}</td>
      ))}
      <td className="py-2 px-3 text-right tabular-nums">{pct(margen.total)}</td>
    </tr>
  );
}

function buildCsvRows(data: EstadoResultados) {
  const rowOf = (seccion: string, concepto: string, f: { porModo: Record<ModoColumna, number>; total: number }) => ({
    seccion,
    concepto,
    maritimo: f.porModo["Marítimo"].toFixed(2),
    aereo: f.porModo["Aéreo"].toFixed(2),
    terrestre: f.porModo["Terrestre"].toFixed(2),
    total: f.total.toFixed(2),
  });
  const rows: Record<string, unknown>[] = [];
  for (const r of data.ingresos) rows.push(rowOf("Ingresos", r.concepto, r));
  rows.push(rowOf("Ingresos", "TOTAL INGRESOS", data.totalIngresos));
  for (const r of data.costos) rows.push(rowOf("Costos", r.concepto, r));
  rows.push(rowOf("Costos", "TOTAL COSTOS", data.totalCostos));
  rows.push(rowOf("Resultado", "UTILIDAD BRUTA", data.utilidad));
  rows.push({
    seccion: "Resultado",
    concepto: "MARGEN %",
    maritimo: data.margen["Marítimo"].toFixed(2),
    aereo: data.margen["Aéreo"].toFixed(2),
    terrestre: data.margen["Terrestre"].toFixed(2),
    total: data.margen.total.toFixed(2),
  });
  return rows;
}

export default function ProfitEstadoResultados() {
  const c = useEstadoResultados();
  const data = c.data;

  const handleExport = () => {
    if (!data) return;
    exportToCsv(`estado-resultados-${c.mesActual.key}.csv`, CSV_HEADERS, buildCsvRows(data));
  };

  const sinDatos = !c.isLoading && data && data.ingresos.length === 0 && data.costos.length === 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Estado de Resultados"
        description="P&G mensual por modo de transporte basado en ETA del embarque"
      />

      <Card>
        <CardContent className="p-4 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <Button variant="outline" size="icon" className="h-9 w-9" onClick={c.irMesAnterior} disabled={!c.puedeIrAtras} aria-label="Mes anterior">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Select value={c.mesActual.key} onValueChange={c.setMesKey}>
              <SelectTrigger className="w-[220px] font-medium"><SelectValue /></SelectTrigger>
              <SelectContent>
                {c.mesesDisponibles.slice().reverse().map((m) => (
                  <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" className="h-9 w-9" onClick={c.irMesSiguiente} disabled={!c.puedeIrAdelante} aria-label="Mes siguiente">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex-1" />
          <Button variant="outline" onClick={handleExport} disabled={!data || sinDatos === true}>
            <Download className="h-4 w-4 mr-2" /> Exportar CSV
          </Button>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground flex items-center gap-1.5 px-1">
        <Info className="h-3 w-3" />
        Montos en MXN. Conceptos en USD/EUR convertidos con el tipo de cambio del propio embarque. Excluye embarques cancelados y modalidad Multimodal.
      </p>

      <Card>
        <CardContent className="p-0">
          {c.isLoading ? (
            <div className="p-6 space-y-3">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : sinDatos || !data ? (
            <EmptyStateInline
              icon={Calendar}
              message={`Sin embarques con ETA en ${c.mesActual.label}`}
              hint="Selecciona otro mes."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 border-b-2">
                  <tr>
                    <th className="py-3 px-3 text-left font-semibold w-[40%]">Concepto</th>
                    {MODOS_COLUMNAS.map((m) => (
                      <th key={m} className="py-3 px-3 text-right font-semibold">{m}</th>
                    ))}
                    <th className="py-3 px-3 text-right font-semibold bg-muted/70">TOTAL</th>
                  </tr>
                </thead>
                <tbody>
                  <SectionHeader label="Ingresos" />
                  {data.ingresos.length === 0 ? (
                    <tr><td colSpan={5} className="py-3 px-6 text-muted-foreground italic">Sin ingresos registrados.</td></tr>
                  ) : (
                    data.ingresos.map((r: FilaER) => <Row key={`v-${r.concepto}`} label={r.concepto} fila={r} />)
                  )}
                  <TotalRow label="TOTAL INGRESOS" valores={data.totalIngresos} />

                  <SectionHeader label="Costos" />
                  {data.costos.length === 0 ? (
                    <tr><td colSpan={5} className="py-3 px-6 text-muted-foreground italic">Sin costos registrados.</td></tr>
                  ) : (
                    data.costos.map((r: FilaER) => <Row key={`c-${r.concepto}`} label={r.concepto} fila={r} />)
                  )}
                  <TotalRow label="TOTAL COSTOS" valores={data.totalCostos} />

                  <tr><td colSpan={5} className="h-2" /></tr>
                  <TotalRow label="UTILIDAD BRUTA" valores={data.utilidad} variant="primary" />
                  <MargenRow margen={data.margen} />
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
