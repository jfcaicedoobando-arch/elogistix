import { formatCurrency } from "@/lib/formatters";
import { MODOS_COLUMNAS, type EstadoResultados, type FilaER, type ModoColumna, type TotalER } from "@/lib/domain/estadoResultados";

export function fmt(n: number): string {
  if (n === 0) return "—";
  return formatCurrency(n, "MXN");
}

export function pct(n: number): string {
  return `${n.toFixed(1)}%`;
}

function Row({ label, fila }: { label: string; fila: FilaER }) {
  return (
    <tr className="border-b">
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

function TotalRow({ label, valores, variant = "muted" }: { label: string; valores: TotalER; variant?: "muted" | "primary" }) {
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

function MargenRow({ margen }: { margen: TotalER }) {
  return (
    <tr className="bg-muted/60 font-semibold text-sm">
      <td className="py-2 px-3">Margen %</td>
      {MODOS_COLUMNAS.map((m) => (
        <td key={m} className="py-2 px-3 text-right tabular-nums">{pct(margen.porModo[m])}</td>
      ))}
      <td className="py-2 px-3 text-right tabular-nums">{pct(margen.total)}</td>
    </tr>
  );
}

function EmptyRow({ label }: { label: string }) {
  return (
    <tr><td colSpan={5} className="py-3 px-6 text-muted-foreground italic">{label}</td></tr>
  );
}

export function EstadoResultadosTable({ data }: { data: EstadoResultados }) {
  return (
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
          {data.ingresos.length === 0
            ? <EmptyRow label="Sin ingresos registrados." />
            : data.ingresos.map((r) => <Row key={`v-${r.concepto}`} label={r.concepto} fila={r} />)}
          <TotalRow label="TOTAL INGRESOS" valores={data.totalIngresos} />

          <SectionHeader label="Costos" />
          {data.costos.length === 0
            ? <EmptyRow label="Sin costos registrados." />
            : data.costos.map((r) => <Row key={`c-${r.concepto}`} label={r.concepto} fila={r} />)}
          <TotalRow label="TOTAL COSTOS" valores={data.totalCostos} />

          <tr><td colSpan={5} className="h-2" /></tr>
          <TotalRow label="UTILIDAD BRUTA" valores={data.utilidad} variant="primary" />
          <MargenRow margen={data.margen} />
        </tbody>
      </table>
    </div>
  );
}

export const ESTADO_RESULTADOS_CSV_HEADERS = [
  { key: "seccion", label: "Sección" },
  { key: "concepto", label: "Concepto" },
  { key: "maritimo", label: "Marítimo" },
  { key: "aereo", label: "Aéreo" },
  { key: "terrestre", label: "Terrestre" },
  { key: "total", label: "Total" },
] as const;

export function buildEstadoResultadosCsvRows(data: EstadoResultados) {
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
    maritimo: data.margen.porModo["Marítimo"].toFixed(2),
    aereo: data.margen.porModo["Aéreo"].toFixed(2),
    terrestre: data.margen.porModo["Terrestre"].toFixed(2),
    total: data.margen.total.toFixed(2),
  });
  return rows;
}
