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
import type { DimensionLCL } from "@/features/cotizacion/hooks";
import SeccionMercanciaWrapper from "./SeccionMercanciaWrapper";
import type { CotizacionFormValues } from "@/features/cotizacion/hooks";

interface Props {
  msdsFile: File | null;
  setMsdsFile: (f: File | null) => void;
}

function calcularVolumen(d: DimensionLCL): number {
  return (d.alto_cm * d.largo_cm * d.ancho_cm * d.piezas) / 1_000_000;
}

export default function SeccionMercanciaMaritimaLCL({ msdsFile, setMsdsFile }: Props) {
  const { watch, setValue } = useFormContext<CotizacionFormValues>();
  const dimensiones = watch("dimensionesLCL");
  const pesoKg = watch("pesoKg");

  const actualizarDimension = (index: number, campo: keyof DimensionLCL, valor: number) => {
    const copia = [...dimensiones];
    copia[index] = { ...copia[index], [campo]: valor };
    copia[index].volumen_m3 = calcularVolumen(copia[index]);
    setValue("dimensionesLCL", copia);
  };

  const agregarFila = () => {
    setValue("dimensionesLCL", [...dimensiones, { piezas: 0, alto_cm: 0, largo_cm: 0, ancho_cm: 0, volumen_m3: 0 }]);
  };

  const eliminarFila = (index: number) => {
    if (dimensiones.length <= 1) return;
    setValue("dimensionesLCL", dimensiones.filter((_, i) => i !== index));
  };

  const totalPiezas = dimensiones.reduce((sum, d) => sum + d.piezas, 0);
  const totalVolumen = dimensiones.reduce((sum, d) => sum + d.volumen_m3, 0);
  // v13.299.0: W/M = max(peso_t, volumen_m3). Se muestra como referencia
  // aunque el flete se cotice por tarifa vinculada o captura manual.
  const wm = Math.max((pesoKg || 0) / 1000, totalVolumen);

  return (
    <SeccionMercanciaWrapper msdsFile={msdsFile} setMsdsFile={setMsdsFile}>
      <Card className="bg-muted/40 border-dashed">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Ruler className="h-4 w-4 text-primary" /> Dimensiones LCL
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
                  <DetailTableHead className="w-28">Volumen m³</DetailTableHead>
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
                      <Input value={dim.volumen_m3.toFixed(4)} readOnly className="h-8 bg-muted text-right tabular-nums" />
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
          <div className="flex flex-wrap justify-end items-center gap-3 mt-3">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Peso total (kg):</span>
              <div className="w-32">
                <NumericInput
                  value={pesoKg}
                  onChange={(n) => setValue("pesoKg", n)}
                  decimals
                  aria-label="Peso total en kilogramos"
                />
              </div>
            </div>
            <div className="flex gap-6 text-sm font-semibold">
              <span>Piezas: {totalPiezas}</span>
              <span>Volumen: {totalVolumen.toFixed(4)} m³</span>
              <span className="text-primary">W/M: {wm.toFixed(3)}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </SeccionMercanciaWrapper>
  );
}