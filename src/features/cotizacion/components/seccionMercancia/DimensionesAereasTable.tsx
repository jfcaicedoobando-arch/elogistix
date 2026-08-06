// Tabla estática de detalle de mercancía (read-only, sin sort/paginación). No requiere DataTable.
// Exenta de no-restricted-imports vía eslint.config.js allowlist.
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
              <TableHead className="text-right">Piezas</TableHead>
              <TableHead className="text-right">Alto (cm)</TableHead>
              <TableHead className="text-right">Largo (cm)</TableHead>
              <TableHead className="text-right">Ancho (cm)</TableHead>
              <TableHead className="text-right">Peso vol. (kg)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {dimensiones.map((d, i) => (
              <TableRow key={i}>
                <TableCell className="text-right tabular-nums">{d.piezas}</TableCell>
                <TableCell className="text-right tabular-nums">{d.alto_cm}</TableCell>
                <TableCell className="text-right tabular-nums">{d.largo_cm}</TableCell>
                <TableCell className="text-right tabular-nums">{d.ancho_cm}</TableCell>
                <TableCell className="text-right tabular-nums">{d.peso_volumetrico_kg.toFixed(2)}</TableCell>
              </TableRow>
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
