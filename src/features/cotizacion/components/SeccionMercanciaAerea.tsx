import { useFormContext } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { NumericInput } from "@/components/shared/NumericInput";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHeader, TableRow,
} from "@/components/ui/table";
import { DetailTableHead, DetailTableRow } from "@/components/shared/DetailTable";
import { Plus, Trash2, Ruler } from "lucide-react";
import type { DimensionAerea } from "@/features/cotizacion/hooks";
import SeccionMercanciaWrapper from "./SeccionMercanciaWrapper";
import type { CotizacionFormValues } from "@/features/cotizacion/hooks";

interface Props {
  msdsFile: File | null;
  setMsdsFile: (f: File | null) => void;
}

function calcularPesoVolumetrico(d: DimensionAerea): number {
  return (d.alto_cm * d.largo_cm * d.ancho_cm * d.piezas) / 6000;
}

export default function SeccionMercanciaAerea({ msdsFile, setMsdsFile }: Props) {
  const { watch, setValue } = useFormContext<CotizacionFormValues>();
  const dimensiones = watch("dimensionesAereas");

  const actualizarDimension = (index: number, campo: keyof DimensionAerea, valor: number) => {
    const copia = [...dimensiones];
    copia[index] = { ...copia[index], [campo]: valor };
    copia[index].peso_volumetrico_kg = calcularPesoVolumetrico(copia[index]);
    setValue("dimensionesAereas", copia);
  };

  const agregarFila = () => {
    setValue("dimensionesAereas", [...dimensiones, { piezas: 0, alto_cm: 0, largo_cm: 0, ancho_cm: 0, peso_volumetrico_kg: 0 }]);
  };

  const eliminarFila = (index: number) => {
    if (dimensiones.length <= 1) return;
    setValue("dimensionesAereas", dimensiones.filter((_, i) => i !== index));
  };

  const totalPiezas = dimensiones.reduce((sum, d) => sum + d.piezas, 0);
  const totalPesoVolumetrico = dimensiones.reduce((sum, d) => sum + d.peso_volumetrico_kg, 0);

  return (
    <SeccionMercanciaWrapper msdsFile={msdsFile} setMsdsFile={setMsdsFile}>
      <Card className="bg-muted/40 border-dashed">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Ruler className="h-4 w-4 text-primary" /> Dimensiones Aéreas
            </CardTitle>
            <Button variant="outline" size="sm" onClick={agregarFila}>
              <Plus className="h-4 w-4 mr-1" /> Agregar medidas
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="border rounded-md overflow-auto bg-background">
            <Table>
              <TableHeader>
                <TableRow>
                  <DetailTableHead className="w-20">Piezas</DetailTableHead>
                  <DetailTableHead className="w-24">Alto (cm)</DetailTableHead>
                  <DetailTableHead className="w-24">Largo (cm)</DetailTableHead>
                  <DetailTableHead className="w-24">Ancho (cm)</DetailTableHead>
                  <DetailTableHead className="w-32">Peso vol. (kg)</DetailTableHead>
                  <DetailTableHead className="w-12"></DetailTableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dimensiones.map((dim, i) => (
                  <DetailTableRow key={i}>
                    <TableCell>
                      <NumericInput value={dim.piezas} onChange={n => actualizarDimension(i, 'piezas', n)} aria-label="Piezas" />
                    </TableCell>
                    <TableCell>
                      <NumericInput value={dim.alto_cm} onChange={n => actualizarDimension(i, 'alto_cm', n)} decimals aria-label="Alto en centímetros" />
                    </TableCell>
                    <TableCell>
                      <NumericInput value={dim.largo_cm} onChange={n => actualizarDimension(i, 'largo_cm', n)} decimals aria-label="Largo en centímetros" />
                    </TableCell>
                    <TableCell>
                      <NumericInput value={dim.ancho_cm} onChange={n => actualizarDimension(i, 'ancho_cm', n)} decimals aria-label="Ancho en centímetros" />
                    </TableCell>
                    <TableCell>
                      <Input value={dim.peso_volumetrico_kg.toFixed(2)} readOnly className="h-8 bg-muted text-right tabular-nums" />
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => eliminarFila(i)} disabled={dimensiones.length <= 1} className="h-8 w-8" aria-label="Eliminar fila">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </DetailTableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex justify-end gap-6 mt-2 text-sm font-semibold">
            <span>Total piezas: {totalPiezas}</span>
            <span>Peso volumétrico total: {totalPesoVolumetrico.toFixed(2)} kg</span>
          </div>
        </CardContent>
      </Card>
    </SeccionMercanciaWrapper>
  );
}