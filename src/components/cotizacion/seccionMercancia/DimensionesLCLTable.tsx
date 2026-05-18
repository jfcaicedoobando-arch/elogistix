// Tabla estática de detalle de mercancía (read-only, sin sort/paginación). No requiere DataTable.
// eslint-disable-next-line no-restricted-imports
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { DimensionLCL } from "@/hooks/cotizacion";

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
              <TableHead>Piezas</TableHead>
              <TableHead>Alto (cm)</TableHead>
              <TableHead>Largo (cm)</TableHead>
              <TableHead>Ancho (cm)</TableHead>
              <TableHead>Volumen m³</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {dimensiones.map((d, i) => (
              <TableRow key={i}>
                <TableCell>{d.piezas}</TableCell>
                <TableCell>{d.alto_cm}</TableCell>
                <TableCell>{d.largo_cm}</TableCell>
                <TableCell>{d.ancho_cm}</TableCell>
                <TableCell>{d.volumen_m3.toFixed(4)}</TableCell>
              </TableRow>
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
