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
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Trash2 } from "lucide-react";
import { usePuertos } from "@/features/catalogos/hooks/usePuertos";
import { useCosteoRutas, useCosteoRutaMutations } from "@/features/costeo/hooks/useCosteoRutas";
import { PageHeader } from "@/components/shared/PageHeader";
import { ConfirmDeleteAlert } from "@/features/costeo/components/ConfirmDeleteAlert";

export default function CosteoRutas() {
  const { data: rutas = [], isLoading } = useCosteoRutas();
  const { data: puertos = [] } = usePuertos();
  const { crear, eliminar } = useCosteoRutaMutations();
  const [open, setOpen] = useState(false);
  const [origenId, setOrigenId] = useState<string>("");
  const [destinoId, setDestinoId] = useState<string>("");
  const [aEliminar, setAEliminar] = useState<string | null>(null);
  const [intentoEnvio, setIntentoEnvio] = useState(false);

  const puertosCN = useMemo(
    () => puertos.filter((p) => ["china", "cn"].includes((p.country ?? "").trim().toLowerCase())),
    [puertos],
  );
  const puertosMX = useMemo(
    () => puertos.filter((p) => ["méxico", "mexico", "mx"].includes((p.country ?? "").trim().toLowerCase())),
    [puertos],
  );

  const handleGuardar = async (e: React.FormEvent) => {
    e.preventDefault();
    setIntentoEnvio(true);
    if (!origenId || !destinoId) return;
    await crear.mutateAsync({ puerto_origen_id: origenId, puerto_destino_id: destinoId });
    setOrigenId("");
    setDestinoId("");
    setIntentoEnvio(false);
    setOpen(false);
  };

  const origenInvalido = intentoEnvio && !origenId;
  const destinoInvalido = intentoEnvio && !destinoId;

  return (
    <div className="p-6 space-y-4">
      <PageHeader
        title="Rutas marítimas"
        description="Pares puerto China → puerto México disponibles para tarificar."
        actions={<Button onClick={() => { setIntentoEnvio(false); setOpen(true); }}><Plus className="size-4 mr-2" />Nueva ruta</Button>}
      />

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
                    onClick={() => setAEliminar(r.id)}
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
            <DialogDescription>Agrega una nueva ruta de origen en China a destino en México.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleGuardar} className="space-y-3">
            <div>
              <Label htmlFor="ruta-origen">Puerto de origen (China) *</Label>
              <Select value={origenId} onValueChange={setOrigenId}>
                <SelectTrigger
                  id="ruta-origen"
                  aria-invalid={origenInvalido || undefined}
                  className={origenInvalido ? "border-destructive" : undefined}
                >
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
              <Label htmlFor="ruta-destino">Puerto de destino (México) *</Label>
              <Select value={destinoId} onValueChange={setDestinoId}>
                <SelectTrigger
                  id="ruta-destino"
                  aria-invalid={destinoInvalido || undefined}
                  className={destinoInvalido ? "border-destructive" : undefined}
                >
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
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={crear.isPending}>
                Guardar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteAlert
        open={!!aEliminar}
        onOpenChange={(o) => !o && setAEliminar(null)}
        title="¿Eliminar esta ruta?"
        description="Esta acción no se puede deshacer."
        pending={eliminar.isPending}
        onConfirm={() => {
          if (aEliminar) {
            eliminar.mutate(aEliminar, { onSuccess: () => setAEliminar(null) });
          }
        }}
      />
    </div>
  );
}
