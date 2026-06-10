/**
 * Página: Rutas de costeo (par puerto origen CN → destino MX).
 */
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Trash2 } from "lucide-react";
import { usePuertos } from "@/hooks/catalogos/usePuertos";
import { useCosteoRutas, useCosteoRutaMutations } from "@/features/costeo/hooks/useCosteoRutas";

export default function CosteoRutas() {
  const { data: rutas = [], isLoading } = useCosteoRutas();
  const { data: puertos = [] } = usePuertos();
  const { crear, eliminar } = useCosteoRutaMutations();
  const [open, setOpen] = useState(false);
  const [origenId, setOrigenId] = useState<string>("");
  const [destinoId, setDestinoId] = useState<string>("");

  const puertosCN = useMemo(() => puertos.filter((p) => p.country === "CN"), [puertos]);
  const puertosMX = useMemo(() => puertos.filter((p) => p.country === "MX"), [puertos]);

  const handleGuardar = async () => {
    if (!origenId || !destinoId) return;
    await crear.mutateAsync({ puerto_origen_id: origenId, puerto_destino_id: destinoId });
    setOrigenId("");
    setDestinoId("");
    setOpen(false);
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Rutas marítimas</h1>
          <p className="text-sm text-muted-foreground">
            Pares puerto China → puerto México disponibles para tarificar.
          </p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="size-4 mr-2" />
          Nueva ruta
        </Button>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Origen (CN)</TableHead>
              <TableHead>Destino (MX)</TableHead>
              <TableHead>Activa</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  Cargando…
                </TableCell>
              </TableRow>
            )}
            {!isLoading && rutas.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  Sin rutas registradas.
                </TableCell>
              </TableRow>
            )}
            {rutas.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.puerto_origen_nombre ?? "—"}</TableCell>
                <TableCell>{r.puerto_destino_nombre ?? "—"}</TableCell>
                <TableCell>{r.activa ? "Sí" : "No"}</TableCell>
                <TableCell>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      if (confirm("¿Eliminar esta ruta?")) eliminar.mutate(r.id);
                    }}
                    aria-label="Eliminar ruta"
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nueva ruta CN → MX</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Puerto de origen (China)</Label>
              <Select value={origenId} onValueChange={setOrigenId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona puerto chino" />
                </SelectTrigger>
                <SelectContent>
                  {puertosCN.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} ({p.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Puerto de destino (México)</Label>
              <Select value={destinoId} onValueChange={setDestinoId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona puerto mexicano" />
                </SelectTrigger>
                <SelectContent>
                  {puertosMX.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} ({p.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleGuardar} disabled={!origenId || !destinoId || crear.isPending}>
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
