import { MODOS_COLUMNAS, type EstadoResultados, type FilaER, type TotalER } from "@/features/profit/domain/estadoResultados";
import { fmt, pct } from "./EstadoResultadosTable.helpers";

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

function MobileFilaCard({ label, fila }: { label: string; fila: FilaER | TotalER; emphasis?: boolean }) {
  return (
    <div className="border-b py-2 px-3 space-y-1">
      <div className="text-sm font-medium">{label}</div>
      <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-xs">
        {MODOS_COLUMNAS.map((m) => (
          <div key={m} className="flex justify-between">
            <span className="text-muted-foreground">{m}</span>
            <span className="tabular-nums">{fmt(fila.porModo[m])}</span>
          </div>
        ))}
        <div className="col-span-2 flex justify-between border-t pt-1 font-semibold">
          <span>Total</span>
          <span className="tabular-nums">{fmt(fila.total)}</span>
        </div>
      </div>
    </div>
  );
}

function MobileSection({ label, filas, total, totalLabel, totalVariant }: {
  label: string;
  filas: FilaER[];
  total: TotalER;
  totalLabel: string;
  totalVariant?: "muted" | "primary";
}) {
  const bg = totalVariant === "primary" ? "bg-primary/10" : "bg-muted";
  return (
    <div>
      <div className="bg-primary/5 border-y px-3 py-2 text-xs font-bold uppercase tracking-wider text-primary">
        {label}
      </div>
      {filas.length === 0
        ? <div className="px-3 py-3 text-xs text-muted-foreground italic">Sin registros.</div>
        : filas.map((r) => <MobileFilaCard key={`m-${label}-${r.concepto}`} label={r.concepto} fila={r} />)}
      <div className={`${bg} font-bold px-3 py-2 flex items-center justify-between text-sm`}>
        <span>{totalLabel}</span>
        <span className="tabular-nums">{fmt(total.total)}</span>
      </div>
    </div>
  );
}

export function EstadoResultadosTable({ data }: { data: EstadoResultados }) {
  return (
    <>
      {/* Mobile (<sm): tarjetas apiladas para que ninguna cifra quede cortada. */}
      <div className="sm:hidden">
        <MobileSection
          label="Ingresos"
          filas={data.ingresos}
          total={data.totalIngresos}
          totalLabel="TOTAL INGRESOS"
        />
        <MobileSection
          label="Costos"
          filas={data.costos}
          total={data.totalCostos}
          totalLabel="TOTAL COSTOS"
        />
        <div className="bg-primary/10 font-bold px-3 py-2.5 flex items-center justify-between border-y">
          <span>UTILIDAD BRUTA</span>
          <span className="tabular-nums">{fmt(data.utilidad.total)}</span>
        </div>
        <div className="bg-muted/60 font-semibold px-3 py-2 flex items-center justify-between text-sm">
          <span>Margen %</span>
          <span className="tabular-nums">{pct(data.margen.total)}</span>
        </div>
      </div>

      {/* Desktop / tablet (≥sm): tabla completa con scroll horizontal. */}
      <div className="hidden sm:block overflow-x-auto">
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
    </>
  );
}
