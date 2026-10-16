import type { ReactNode } from "react";
import { MargenTexto } from "@/components/shared/MargenBadge";
import { SectionHeading } from "@/components/shared/SectionHeading";
import { UMBRAL_MARGEN_OPERATIVO } from "@/lib/ui/margen";
import { MODOS_COLUMNAS, type EstadoResultados, type FilaER, type TotalER } from "../domain/estadoResultados";
import { fmt } from "./EstadoResultadosTable.helpers";

function MobileValue({ label, children, total = false }: {
  label: string;
  children: ReactNode;
  total?: boolean;
}) {
  return (
    <div className={`flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 ${total ? "border-t pt-2 font-semibold" : ""}`}>
      <dt className={total ? undefined : "text-muted-foreground"}>{label}</dt>
      <dd className="ml-auto max-w-full overflow-x-auto whitespace-nowrap text-right tabular-nums">{children}</dd>
    </div>
  );
}

function MobileValues({ label, children, variant = "plain" }: {
  label: string;
  children: ReactNode;
  variant?: "plain" | "muted" | "primary";
}) {
  const bg = variant === "primary" ? "bg-primary/10" : variant === "muted" ? "bg-muted" : "";
  return (
    <section aria-label={label} className={`${bg} min-w-0 border-b px-3 py-3 text-body-sm`}>
      <SectionHeading as="h3" variant="subsection" className="mb-2 [&_h3>span]:whitespace-normal [&_h3>span]:break-words">
        {label}
      </SectionHeading>
      <dl className="space-y-2">{children}</dl>
    </section>
  );
}

function MobileAmounts({ label, fila, variant, noDisponible = false }: {
  label: string;
  fila: TotalER;
  variant?: "muted" | "primary";
  noDisponible?: boolean;
}) {
  return (
    <MobileValues label={label} variant={variant}>
      {MODOS_COLUMNAS.map((modo) => (
        <MobileValue key={modo} label={modo}>
          {noDisponible ? "No disponible" : fmt(fila.porModo[modo])}
        </MobileValue>
      ))}
      <MobileValue label="Total" total>{noDisponible ? "No disponible" : fmt(fila.total)}</MobileValue>
    </MobileValues>
  );
}

function MobileSection({ label, filas, total, totalLabel }: {
  label: string;
  filas: FilaER[];
  total: TotalER;
  totalLabel: string;
}) {
  return (
    <div>
      <h2 className="bg-primary/5 border-y px-3 py-2 text-body-sm font-bold uppercase tracking-wider text-primary">
        {label}
      </h2>
      {filas.length === 0
        ? <p className="px-3 py-3 text-body-sm text-muted-foreground italic">Sin registros.</p>
        : filas.map((fila) => <MobileAmounts key={fila.concepto} label={fila.concepto} fila={fila} />)}
      <MobileAmounts label={totalLabel} fila={total} variant="muted" />
    </div>
  );
}

function MobileMargin({ margen, ingresos, incompleta }: {
  margen: TotalER;
  ingresos: TotalER;
  incompleta: boolean;
}) {
  const value = (pct: number, ingreso: number) => incompleta
    ? "No disponible"
    : ingreso === 0 ? "No calculable" : <MargenTexto pct={pct} umbrales={UMBRAL_MARGEN_OPERATIVO} />;
  return (
    <MobileValues label="Margen %" variant="muted">
      {MODOS_COLUMNAS.map((modo) => (
        <MobileValue key={modo} label={modo}>{value(margen.porModo[modo], ingresos.porModo[modo])}</MobileValue>
      ))}
      <MobileValue label="Total" total>{value(margen.total, ingresos.total)}</MobileValue>
    </MobileValues>
  );
}

export function EstadoResultadosMobile({ data, incompleta }: { data: EstadoResultados; incompleta: boolean }) {
  return (
    <>
      <MobileSection label="Ingresos" filas={data.ingresos} total={data.totalIngresos}
        totalLabel={incompleta ? "INGRESOS PARCIALES" : "TOTAL INGRESOS"} />
      <MobileSection label="Costos" filas={data.costos} total={data.totalCostos}
        totalLabel={incompleta ? "COSTOS PARCIALES" : "TOTAL COSTOS"} />
      <MobileAmounts label="UTILIDAD BRUTA" fila={data.utilidad} variant="primary" noDisponible={incompleta} />
      <MobileMargin margen={data.margen} ingresos={data.totalIngresos} incompleta={incompleta} />
    </>
  );
}
