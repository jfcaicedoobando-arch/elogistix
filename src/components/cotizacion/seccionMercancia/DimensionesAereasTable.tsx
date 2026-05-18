import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { DimensionAerea } from "@/hooks/cotizacion";

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
              <TableHead>Piezas</TableHead>
              <TableHead>Alto (cm)</TableHead>
              <TableHead>Largo (cm)</TableHead>
              <TableHead>Ancho (cm)</TableHead>
              <TableHead>Peso vol. (kg)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {dimensiones.map((d, i) => (
              <TableRow key={i}>
                <TableCell>{d.piezas}</TableCell>
                <TableCell>{d.alto_cm}</TableCell>
                <TableCell>{d.largo_cm}</TableCell>
                <TableCell>{d.ancho_cm}</TableCell>
                <TableCell>{d.peso_volumetrico_kg.toFixed(2)}</TableCell>
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
