import { useState } from "react";
import { Plus, Minus, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { containerTypes } from "@/data/containerTypes";
import { getErrorMessage } from "@/lib/errorUtils";
import { useToast } from "@/hooks/use-toast";
import { useDuplicarEmbarque, type EmbarqueRow } from "@/hooks/useEmbarques";

interface FilaCopia {
  num_contenedor: string;
  tipo_contenedor: string;
  peso_kg: number;
  volumen_m3: number;
  piezas: number;
}

interface Props {
  embarque: EmbarqueRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function DialogDuplicarEmbarque({ embarque, open, onOpenChange }: Props) {
  const { toast } = useToast();
  const duplicarEmbarque = useDuplicarEmbarque();

  const crearFilaInicial = (): FilaCopia => ({
    num_contenedor: '',
    tipo_contenedor: embarque.tipo_contenedor || '',
    peso_kg: Number(embarque.peso_kg) || 0,
    volumen_m3: Number(embarque.volumen_m3) || 0,
    piezas: embarque.piezas || 0,
  });

  const [filaCopias, setFilaCopias] = useState<FilaCopia[]>([crearFilaInicial()]);

  const ajustarCantidad = (delta: number) => {
    setFilaCopias(prev => {
      if (delta > 0 && prev.length < 10) return [...prev, crearFilaInicial()];
      if (delta < 0 && prev.length > 1) return prev.slice(0, -1);
      return prev;
    });
  };

  const actualizarFila = (index: number, campo: keyof FilaCopia, valor: string | number) => {
    setFilaCopias(prev => {
      const copia = [...prev];
      copia[index] = { ...copia[index], [campo]: valor };
      return copia;
    });
  };

  const handleDuplicar = async () => {
    try {
      const creados = await duplicarEmbarque.mutateAsync({ embarqueOrigen: embarque, copias: filaCopias });
      toast({ title: `Se crearon ${creados.length} embarque(s)`, description: creados.map(c => c.expediente).join(', ') });
      onOpenChange(false);
    } catch (err: unknown) {
      toast({ title: "Error al duplicar", description: getErrorMessage(err), variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) setFilaCopias([crearFilaInicial()]); onOpenChange(v); }}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Duplicar Embarque</DialogTitle>
          <DialogDescription>Desde {embarque.expediente} — BL: {embarque.bl_master || 'N/A'}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">¿Cuántos contenedores adicionales?</span>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => ajustarCantidad(-1)} disabled={filaCopias.length <= 1}>
                <Minus className="h-4 w-4" />
              </Button>
              <span className="w-8 text-center font-semibold">{filaCopias.length}</span>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => ajustarCantidad(1)} disabled={filaCopias.length >= 10}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">#</TableHead>
                <TableHead># Contenedor</TableHead>
                <TableHead>Tipo Contenedor</TableHead>
                <TableHead>Peso (kg)</TableHead>
                <TableHead>Volumen (m³)</TableHead>
                <TableHead>Piezas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filaCopias.map((fila, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{i + 1}</TableCell>
                  <TableCell>
                    <Input value={fila.num_contenedor} onChange={e => actualizarFila(i, 'num_contenedor', e.target.value)} placeholder="ABCD1234567" className="h-8" />
                  </TableCell>
                  <TableCell>
                    <Select value={fila.tipo_contenedor} onValueChange={v => actualizarFila(i, 'tipo_contenedor', v)}>
                      <SelectTrigger className="h-8"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                      <SelectContent>
                        {containerTypes.map(ct => <SelectItem key={ct.code} value={ct.name}>{ct.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell><Input type="number" value={fila.peso_kg} onChange={e => actualizarFila(i, 'peso_kg', Number(e.target.value))} className="h-8 w-24" /></TableCell>
                  <TableCell><Input type="number" value={fila.volumen_m3} onChange={e => actualizarFila(i, 'volumen_m3', Number(e.target.value))} className="h-8 w-24" /></TableCell>
                  <TableCell><Input type="number" value={fila.piezas} onChange={e => actualizarFila(i, 'piezas', Number(e.target.value))} className="h-8 w-20" /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="flex items-start gap-2 rounded-md border border-accent bg-accent/20 p-3 text-sm text-accent-foreground">
            <Info className="h-4 w-4 mt-0.5 shrink-0" />
            <span>Se copiará automáticamente: Cliente · BL Master · Naviera · Ruta · Fechas · Conceptos de venta · Costos internos</span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleDuplicar} disabled={duplicarEmbarque.isPending}>
            {duplicarEmbarque.isPending ? 'Creando...' : `Crear ${filaCopias.length} Embarque${filaCopias.length > 1 ? 's' : ''}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
