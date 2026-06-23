/**
 * Diálogo para alta de una nueva ruta CN → MX.
 * Migrado a FormDialogShell (Ola 2 — Costeo).
 */
import { useMemo, useState } from "react";
import { Route } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { FormDialogSection } from "@/components/shared/FormDialogSection";
import type { useCosteoRutaMutations } from "@/features/costeo/hooks/useCosteoRutas";
import { usePuertos } from "@/features/catalogos/hooks/usePuertos";
import type { CosteoRuta } from "@/features/costeo/types";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  crear: ReturnType<typeof useCosteoRutaMutations>["crear"];
  rutas: CosteoRuta[];
}

export function RutaFormDialog({ open, onOpenChange, crear, rutas }: Props) {
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

  const rutaDuplicada = rutas.some(
    (ruta) => ruta.puerto_origen_id === origenId && ruta.puerto_destino_id === destinoId,
  );
  const mostrarDuplicada = !!origenId && !!destinoId && rutaDuplicada;
  const origenInvalido = intentoEnvio && !origenId;
  const destinoInvalido = intentoEnvio && !destinoId;

  const handleGuardar = async (e: React.FormEvent) => {
    e.preventDefault();
    setIntentoEnvio(true);
    if (!origenId || !destinoId || rutaDuplicada) return;
    try {
      await crear.mutateAsync({ puerto_origen_id: origenId, puerto_destino_id: destinoId });
      setOrigenId("");
      setDestinoId("");
      setIntentoEnvio(false);
      onOpenChange(false);
    } catch {
      // onError del hook ya mostró el toast; mantenemos el diálogo abierto.
    }
  };

  return (
    <FormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={Route}
      title="Nueva ruta CN → MX"
      description="Agrega una nueva ruta de origen en China a destino en México."
      size="lg"
      footer={
        <>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" form="ruta-form" disabled={crear.isPending || rutaDuplicada}>
            Guardar
          </Button>
        </>
      }
    >
      <form id="ruta-form" onSubmit={handleGuardar} className="space-y-4">
        <FormDialogSection cols={1} flat>
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
          {mostrarDuplicada && (
            <p className="text-sm text-destructive" role="alert">
              Esta ruta CN → MX ya está registrada. No necesitas volver a crearla.
            </p>
          )}
        </FormDialogSection>
      </form>
    </FormDialogShell>
  );
}
