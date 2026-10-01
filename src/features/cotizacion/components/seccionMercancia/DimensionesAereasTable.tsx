// Tabla estática de detalle de mercancía (read-only, sin sort/paginación). No requiere DataTable.
// Exenta de no-restricted-imports vía eslint.config.js allowlist.
import { resumenDimensionesAereas } from "@/features/cotizacion/domain/medidasAereas";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { DetailTableHead, DetailTableRow } from "@/components/shared/DetailTable";
import type { DimensionAerea } from "@/features/cotizacion/hooks";

interface Props {
  dimensiones: DimensionAerea[];
  totalPiezas: number;
  pesoFisico?: number | null;
}

export function DimensionesAereasTable({ dimensiones, totalPiezas, pesoFisico }: Props) {
  const medidas = resumenDimensionesAereas(dimensiones);
  return (
    <div>
      <span className="text-body text-muted-foreground font-semibold">Dimensiones</span>
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
      <div className="flex flex-wrap justify-end gap-x-6 gap-y-1 mt-2 text-body font-semibold">
        <span>Total piezas: {totalPiezas}</span>
        <span>Peso físico: {pesoFisico != null && pesoFisico > 0 ? `${pesoFisico} kg` : "No capturado"}</span>
        <span>Peso volumétrico total: {medidas.pesoVolumetricoKg.toFixed(2)} kg</span>
        <span>Volumen total: {medidas.volumenM3.toFixed(2)} m³</span>
      </div>
    </div>
  );
}
