/**
 * Excepción documentada al guardrail `no-raw-table` (Ola F, punto 8):
 * esta tabla tiene subtotales con `colSpan` y una fila de "Margen %" con
 * fondo propio, patrón que `<DataTable />` no soporta. Se homologa con el
 * resto del ERP usando `Table`/`DetailTableHead`/`DetailTableRow` (mismo
 * encabezado, hover y zebra) y la densidad `TABLE_DENSITY.embebida` (tabla
 * dentro de un tab), en vez de un `<table>` crudo con clases sueltas.
 */
import { Table, TableHeader, TableBody, TableCell } from "@/components/ui/table";
import { DetailTableHead, DetailTableRow } from "@/components/shared/DetailTable";
import { TABLE_DENSITY } from "@/components/shared/dataTable/tableTokens";
import { DENSITY_CELL } from "@/components/shared/dataTable/types";
import { MODOS_COLUMNAS, type EstadoResultados, type FilaER, type TotalER } from "@/features/profit/domain/estadoResultados";
import { MargenTexto } from "@/components/shared/MargenBadge";
import { UMBRAL_MARGEN_OPERATIVO } from "@/lib/ui/margen";
import { fmt } from "./EstadoResultadosTable.helpers";

const CELL_PAD = DENSITY_CELL[TABLE_DENSITY.embebida];

function Row({ label, fila }: { label: string; fila: FilaER }) {
  return (
    <DetailTableRow>
      <TableCell className={`${CELL_PAD} pl-6`}>{label}</TableCell>
      {MODOS_COLUMNAS.map((m) => (
        <TableCell key={m} className={`${CELL_PAD} text-right tabular-nums`}>{fmt(fila.porModo[m])}</TableCell>
      ))}
      <TableCell className={`${CELL_PAD} text-right tabular-nums`}>{fmt(fila.total)}</TableCell>
    </DetailTableRow>
  );
}

function SectionHeader({ label }: { label: string }) {
  return (
    <DetailTableRow hoverable={false} className="bg-primary/5 border-t">
      <TableCell colSpan={6} className="py-2 px-3 text-body-sm font-bold uppercase tracking-wider text-primary">
        {label}
      </TableCell>
    </DetailTableRow>
  );
}

function TotalRow({ label, valores, variant = "muted" }: { label: string; valores: TotalER; variant?: "muted" | "primary" }) {
  const bg = variant === "primary" ? "bg-primary/10" : "bg-muted";
  return (
    <DetailTableRow hoverable={false} className={`${bg} font-bold`}>
      <TableCell className="py-2.5 px-3">{label}</TableCell>
      {MODOS_COLUMNAS.map((m) => (
        <TableCell key={m} className="py-2.5 px-3 text-right tabular-nums">{fmt(valores.porModo[m])}</TableCell>
      ))}
      <TableCell className="py-2.5 px-3 text-right tabular-nums">{fmt(valores.total)}</TableCell>
    </DetailTableRow>
  );
}

function MargenRow({ margen }: { margen: TotalER }) {
  return (
    <DetailTableRow hoverable={false} className="bg-muted/60 font-semibold">
      <TableCell className={CELL_PAD}>Margen %</TableCell>
      {MODOS_COLUMNAS.map((m) => (
        <TableCell key={m} className={`${CELL_PAD} text-right`}>
          <MargenTexto pct={margen.porModo[m]} umbrales={UMBRAL_MARGEN_OPERATIVO} />
        </TableCell>
      ))}
      <TableCell className={`${CELL_PAD} text-right`}>
        <MargenTexto pct={margen.total} umbrales={UMBRAL_MARGEN_OPERATIVO} />
      </TableCell>
    </DetailTableRow>
  );
}


function EmptyRow({ label }: { label: string }) {
  return (
    <DetailTableRow hoverable={false}>
      <TableCell colSpan={6} className="py-3 px-6 text-body text-muted-foreground italic">{label}</TableCell>
    </DetailTableRow>
  );
}

function MobileFilaCard({ label, fila }: { label: string; fila: FilaER | TotalER; emphasis?: boolean }) {
  return (
    <div className="border-b py-2 px-3 space-y-1">
      <div className="text-body-sm font-medium">{label}</div>
      <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-body-sm">
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
      <div className="bg-primary/5 border-y px-3 py-2 text-body-sm font-bold uppercase tracking-wider text-primary">
        {label}
      </div>
      {filas.length === 0
        ? <div className="px-3 py-3 text-body-sm text-muted-foreground italic">Sin registros.</div>
        : filas.map((r) => <MobileFilaCard key={`m-${label}-${r.concepto}`} label={r.concepto} fila={r} />)}
      <div className={`${bg} font-bold px-3 py-2 flex items-center justify-between text-body-sm`}>
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
        <div className="bg-muted/60 font-semibold px-3 py-2 flex items-center justify-between text-body-sm">
          <span>Margen %</span>
          <MargenTexto pct={data.margen.total} umbrales={UMBRAL_MARGEN_OPERATIVO} />
        </div>
      </div>

      {/* Desktop / tablet (≥sm): tabla completa con scroll horizontal. */}
      <div className="hidden sm:block overflow-x-auto">
        <Table>
          <TableHeader>
            <DetailTableRow hoverable={false} className="bg-muted/40 border-b-2">
              <DetailTableHead className="w-[40%]">Concepto</DetailTableHead>
              {MODOS_COLUMNAS.map((m) => (
                <DetailTableHead key={m} className="text-right">{m}</DetailTableHead>
              ))}
              <DetailTableHead className="text-right bg-muted/70">TOTAL</DetailTableHead>
            </DetailTableRow>
          </TableHeader>
          <TableBody>
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

            <DetailTableRow hoverable={false}><TableCell colSpan={6} className="h-2 py-0" /></DetailTableRow>
            <TotalRow label="UTILIDAD BRUTA" valores={data.utilidad} variant="primary" />
            <MargenRow margen={data.margen} />
          </TableBody>
        </Table>
      </div>
    </>
  );
}
