import { useFormContext } from "react-hook-form";
import { Label } from "@/components/ui/label";
import { resumenDimensionesAereas } from "@/features/cotizacion/domain/medidasAereas";
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
  const pesoFisico = watch("pesoKg");

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

  const medidas = resumenDimensionesAereas(dimensiones);

  return (
    <SeccionMercanciaWrapper msdsFile={msdsFile} setMsdsFile={setMsdsFile}>
      <div className="space-y-1.5">
        <Label htmlFor="aereo-peso-fisico">Peso físico total (kg)</Label>
        <NumericInput id="aereo-peso-fisico" value={pesoFisico}
          onChange={(n) => setValue("pesoKg", n, { shouldDirty: true })}
          decimals aria-describedby="aereo-peso-ayuda" className="max-w-xs" />
        <p id="aereo-peso-ayuda" className="text-body-sm text-muted-foreground">
          Peso real de la mercancía. Se heredará al embarque; no cambia las cantidades ni los precios cotizados.
          Si no lo conoces, quedará pendiente de captura.
        </p>
      </div>
      <Card className="bg-muted/40 border-dashed">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-body font-semibold flex items-center gap-2">
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
                      <Input value={dim.peso_volumetrico_kg.toFixed(2)} readOnly aria-label="Peso volumétrico en kilogramos" className="h-8 bg-muted text-right tabular-nums" />
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
          <div className="flex flex-wrap justify-end gap-x-6 gap-y-1 mt-2 text-body font-semibold">
            <span>Total piezas: {medidas.piezas}</span>
            <span>Peso volumétrico total: {medidas.pesoVolumetricoKg.toFixed(2)} kg</span>
            <span>Volumen total: {medidas.volumenM3.toFixed(2)} m³</span>
          </div>
        </CardContent>
      </Card>
    </SeccionMercanciaWrapper>
  );
}