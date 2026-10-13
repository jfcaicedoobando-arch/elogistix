import { avisoValuacion, valuacionIncompleta } from "../domain/valuacion";
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
import { EstadoResultadosMobile } from "./EstadoResultadosMobile";

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

function TotalRow({ label, valores, noDisponible, variant = "muted" }: { label: string; valores: TotalER; noDisponible?: boolean; variant?: "muted" | "primary" }) {
  const bg = variant === "primary" ? "bg-primary/10" : "bg-muted";
  return (
    <DetailTableRow hoverable={false} className={`${bg} font-bold`}>
      <TableCell className="py-2.5 px-3">{label}</TableCell>
      {MODOS_COLUMNAS.map((m) => (
        <TableCell key={m} className="py-2.5 px-3 text-right tabular-nums">{noDisponible ? "No disponible" : fmt(valores.porModo[m])}</TableCell>
      ))}
      <TableCell className="py-2.5 px-3 text-right tabular-nums">{noDisponible ? "No disponible" : fmt(valores.total)}</TableCell>
    </DetailTableRow>
  );
}

function MargenRow({ margen, ingresos, incompleta }: { margen: TotalER; ingresos: TotalER; incompleta: boolean }) {
  return (
    <DetailTableRow hoverable={false} className="bg-muted/60 font-semibold">
      <TableCell className={CELL_PAD}>Margen %</TableCell>
      {MODOS_COLUMNAS.map((m) => (
        <TableCell key={m} className={`${CELL_PAD} text-right`}>
          {incompleta ? "No disponible" : ingresos.porModo[m] === 0 ? "No calculable" : <MargenTexto pct={margen.porModo[m]} umbrales={UMBRAL_MARGEN_OPERATIVO} />}
        </TableCell>
      ))}
      <TableCell className={`${CELL_PAD} text-right`}>
        {incompleta ? "No disponible" : ingresos.total === 0 ? "No calculable" : <MargenTexto pct={margen.total} umbrales={UMBRAL_MARGEN_OPERATIVO} />}
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

export function EstadoResultadosTable({ data }: { data: EstadoResultados }) {
  const incompleta = valuacionIncompleta(data);
  return (
    <>
      {incompleta && <div role="status" className="p-3 text-sm text-warning">
        <p>{avisoValuacion(data)}</p>
        <details><summary>Conceptos excluidos de los parciales MXN</summary><ul>
          {data.valuacion?.excluidos_sin_tc.map((e, i) => <li key={i}>
            {e.seccion}: {e.concepto} · {e.nominal} {e.moneda} · {e.modo} · Referencia {e.embarque_id}
          </li>)}
        </ul></details>
      </div>}
      {/* Mobile (<sm): conserva el desglose completo con importes indivisibles. */}
      <div className="sm:hidden">
        <EstadoResultadosMobile data={data} incompleta={incompleta} />
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
            <TotalRow label={incompleta ? "INGRESOS PARCIALES" : "TOTAL INGRESOS"} valores={data.totalIngresos} />

            <SectionHeader label="Costos" />
            {data.costos.length === 0
              ? <EmptyRow label="Sin costos registrados." />
              : data.costos.map((r) => <Row key={`c-${r.concepto}`} label={r.concepto} fila={r} />)}
            <TotalRow label={incompleta ? "COSTOS PARCIALES" : "TOTAL COSTOS"} valores={data.totalCostos} />

            <DetailTableRow hoverable={false}><TableCell colSpan={6} className="h-2 py-0" /></DetailTableRow>
            <TotalRow label="UTILIDAD BRUTA" noDisponible={incompleta} valores={data.utilidad} variant="primary" />
            <MargenRow margen={data.margen} ingresos={data.totalIngresos} incompleta={incompleta} />
          </TableBody>
        </Table>
      </div>
    </>
  );
}
