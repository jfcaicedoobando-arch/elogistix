// Tabla estática de detalle de mercancía (read-only, sin sort/paginación). No requiere DataTable.
// Exenta de no-restricted-imports vía eslint.config.js allowlist.
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { DetailTableHead, DetailTableRow } from "@/components/shared/DetailTable";
import type { DimensionAerea } from "@/features/cotizacion/hooks";

interface Props {
  dimensiones: DimensionAerea[];
  totalPiezas: number;
  pesoTotal: number;
}

export function DimensionesAereasTable({ dimensiones, totalPiezas, pesoTotal }: Props) {
  return (
    <div>
      <span className="text-sm text-muted-foreground font-semibold">Dimensiones</span>
      <div className="border rounded-md overflow-auto mt-1">
        <Table>
          <TableHeader>
            <TableRow>
              <DetailTableHead className="text-right">Piezas</DetailTableHead>
              <DetailTableHead className="text-right">Alto (cm)</DetailTableHead>
              <DetailTableHead className="text-right">Largo (cm)</DetailTableHead>
              <DetailTableHead className="text-right">Ancho (cm)</DetailTableHead>
              <DetailTableHead className="text-right">Peso vol. (kg)</DetailTableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {dimensiones.map((d, i) => (
              <DetailTableRow key={i}>
                <TableCell className="text-right tabular-nums">{d.piezas}</TableCell>
                <TableCell className="text-right tabular-nums">{d.alto_cm}</TableCell>
                <TableCell className="text-right tabular-nums">{d.largo_cm}</TableCell>
                <TableCell className="text-right tabular-nums">{d.ancho_cm}</TableCell>
                <TableCell className="text-right tabular-nums">{d.peso_volumetrico_kg.toFixed(2)}</TableCell>
              </DetailTableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="flex justify-end gap-6 mt-2 text-sm font-semibold">
        <span>Total piezas: {totalPiezas}</span>
        <span>Peso volumétrico total: {pesoTotal} kg</span>
      </div>
    </div>
  );
}
