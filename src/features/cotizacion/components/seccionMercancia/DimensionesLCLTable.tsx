// Tabla estática de detalle de mercancía (read-only, sin sort/paginación). No requiere DataTable.
// Exenta de no-restricted-imports vía eslint.config.js allowlist.
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { DetailTableHead, DetailTableRow } from "@/components/shared/DetailTable";
import type { DimensionLCL } from "@/features/cotizacion/hooks";

interface Props {
  dimensiones: DimensionLCL[];
  totalPiezas: number;
  volumenTotal: number;
}

export function DimensionesLCLTable({ dimensiones, totalPiezas, volumenTotal }: Props) {
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
              <DetailTableHead className="text-right">Volumen m³</DetailTableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {dimensiones.map((d, i) => (
              <DetailTableRow key={i}>
                <TableCell className="text-right tabular-nums">{d.piezas}</TableCell>
                <TableCell className="text-right tabular-nums">{d.alto_cm}</TableCell>
                <TableCell className="text-right tabular-nums">{d.largo_cm}</TableCell>
                <TableCell className="text-right tabular-nums">{d.ancho_cm}</TableCell>
                <TableCell className="text-right tabular-nums">{d.volumen_m3.toFixed(4)}</TableCell>
              </DetailTableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="flex justify-end gap-6 mt-2 text-sm font-semibold">
        <span>Total piezas: {totalPiezas}</span>
        <span>Volumen total: {volumenTotal} m³</span>
      </div>
    </div>
  );
}
