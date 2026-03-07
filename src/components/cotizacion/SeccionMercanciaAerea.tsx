import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Plus, Trash2 } from "lucide-react";
import type { DimensionAerea } from "@/hooks/useCotizaciones";
import SeccionMercanciaWrapper from "./SeccionMercanciaWrapper";

interface Props {
  tipoCarga: string;
  setTipoCarga: (v: string) => void;
  sectorEconomico: string;
  setSectorEconomico: (v: string) => void;
  descripcionAdicional: string;
  setDescripcionAdicional: (v: string) => void;
  msdsFile: File | null;
  setMsdsFile: (f: File | null) => void;
  dimensiones: DimensionAerea[];
  setDimensiones: (d: DimensionAerea[]) => void;
}

function calcularPesoVolumetrico(d: DimensionAerea): number {
  return (d.alto_cm * d.largo_cm * d.ancho_cm * d.piezas) / 6000;
}

export default function SeccionMercanciaAerea({
  tipoCarga, setTipoCarga,
  sectorEconomico, setSectorEconomico,
  descripcionAdicional, setDescripcionAdicional,
  msdsFile, setMsdsFile,
  dimensiones, setDimensiones,
}: Props) {
  const actualizarDimension = (index: number, campo: keyof DimensionAerea, valor: number) => {
    const copia = [...dimensiones];
    copia[index] = { ...copia[index], [campo]: valor };
    copia[index].peso_volumetrico_kg = calcularPesoVolumetrico(copia[index]);
    setDimensiones(copia);
  };

  const agregarFila = () => {
    setDimensiones([...dimensiones, { piezas: 0, alto_cm: 0, largo_cm: 0, ancho_cm: 0, peso_volumetrico_kg: 0 }]);
  };

  const eliminarFila = (index: number) => {
    if (dimensiones.length <= 1) return;
    setDimensiones(dimensiones.filter((_, i) => i !== index));
  };

  const totalPiezas = dimensiones.reduce((sum, d) => sum + d.piezas, 0);
  const totalPesoVolumetrico = dimensiones.reduce((sum, d) => sum + d.peso_volumetrico_kg, 0);

  return (
    <SeccionMercanciaWrapper
      tipoCarga={tipoCarga} setTipoCarga={setTipoCarga}
      sectorEconomico={sectorEconomico} setSectorEconomico={setSectorEconomico}
      descripcionAdicional={descripcionAdicional} setDescripcionAdicional={setDescripcionAdicional}
      msdsFile={msdsFile} setMsdsFile={setMsdsFile}
    >
      <div>
        <div className="flex items-center justify-between mb-2">
          <Label className="text-sm font-semibold">Dimensiones</Label>
          <Button variant="outline" size="sm" onClick={agregarFila}>
            <Plus className="h-4 w-4 mr-1" /> Agregar medidas
          </Button>
        </div>
        <div className="border rounded-md overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-20">Piezas</TableHead>
                <TableHead className="w-24">Alto (cm)</TableHead>
                <TableHead className="w-24">Largo (cm)</TableHead>
                <TableHead className="w-24">Ancho (cm)</TableHead>
                <TableHead className="w-32">Peso vol. (kg)</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dimensiones.map((dim, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <Input type="number" min={0} value={dim.piezas} onChange={e => actualizarDimension(i, 'piezas', Number(e.target.value))} className="h-8" />
                  </TableCell>
                  <TableCell>
                    <Input type="number" min={0} step={0.1} value={dim.alto_cm} onChange={e => actualizarDimension(i, 'alto_cm', Number(e.target.value))} className="h-8" />
                  </TableCell>
                  <TableCell>
                    <Input type="number" min={0} step={0.1} value={dim.largo_cm} onChange={e => actualizarDimension(i, 'largo_cm', Number(e.target.value))} className="h-8" />
                  </TableCell>
                  <TableCell>
                    <Input type="number" min={0} step={0.1} value={dim.ancho_cm} onChange={e => actualizarDimension(i, 'ancho_cm', Number(e.target.value))} className="h-8" />
                  </TableCell>
                  <TableCell>
                    <Input value={dim.peso_volumetrico_kg.toFixed(2)} readOnly className="h-8 bg-muted" />
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => eliminarFila(i)} disabled={dimensiones.length <= 1} className="h-8 w-8">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="flex justify-end gap-6 mt-2 text-sm font-semibold">
          <span>Total piezas: {totalPiezas}</span>
          <span>Peso volumétrico total: {totalPesoVolumetrico.toFixed(2)} kg</span>
        </div>
      </div>
    </SeccionMercanciaWrapper>
  );
}
