/**
 * Diálogo para alta de una nueva ruta CN → MX.
 * Extraído de `CosteoRutas.tsx` en v13.56.4 (auditoría — paso 14).
 */
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import type { UseMutationResult } from "@tanstack/react-query";
import { usePuertos } from "@/features/catalogos/hooks/usePuertos";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  crear: UseMutationResult<unknown, Error, { puerto_origen_id: string; puerto_destino_id: string }>;
}

export function RutaFormDialog({ open, onOpenChange, crear }: Props) {
  const { data: puertos = [] } = usePuertos();
  const [origenId, setOrigenId] = useState<string>("");
  const [destinoId, setDestinoId] = useState<string>("");
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
    onOpenChange(false);
  };

  const origenInvalido = intentoEnvio && !origenId;
  const destinoInvalido = intentoEnvio && !destinoId;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={crear.isPending}>
              Guardar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
