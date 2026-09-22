/**
 * Diálogo para alta de una nueva ruta marítima entre dos puertos del catálogo
 * (cualquier país de origen y destino — etapa 1 de rutas globales).
 */
import { useState } from "react";
import { Route } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { FormDialogSection } from "@/components/shared/FormDialogSection";
import { PortIdSelect } from "@/features/catalogos";
import type { useCosteoRutaMutations } from "@/features/costeo/hooks/useCosteoRutas";
import type { CosteoRuta } from "@/features/costeo/types";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  crear: ReturnType<typeof useCosteoRutaMutations>["crear"];
  rutas: CosteoRuta[];
}

export function RutaFormDialog({ open, onOpenChange, crear, rutas }: Props) {
  const [origenId, setOrigenId] = useState<string>("");
  const [destinoId, setDestinoId] = useState<string>("");
  const [intentoEnvio, setIntentoEnvio] = useState(false);

  // Duplicado direccional: A → B y B → A son rutas distintas.
  const rutaDuplicada = rutas.some(
    (ruta) => ruta.puerto_origen_id === origenId && ruta.puerto_destino_id === destinoId,
  );
  const mismoPuerto = !!origenId && origenId === destinoId;
  const mostrarDuplicada = !!origenId && !!destinoId && rutaDuplicada;
  const origenInvalido = intentoEnvio && !origenId;
  const destinoInvalido = intentoEnvio && !destinoId;

  const elegirOrigen = (id: string) => {
    setOrigenId(id);
    if (id && id === destinoId) setDestinoId("");
  };

  const handleGuardar = async (e: React.FormEvent) => {
    e.preventDefault();
    setIntentoEnvio(true);
    if (!origenId || !destinoId || rutaDuplicada || mismoPuerto) return;
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
      title="Nueva ruta marítima"
      description="Agrega una ruta entre dos puertos del catálogo, sin importar el país."
      size="lg"
      footer={
        <>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form="ruta-form"
            disabled={crear.isPending || rutaDuplicada || mismoPuerto}
          >
            Guardar
          </Button>
        </>
      }
    >
      <form id="ruta-form" onSubmit={handleGuardar} className="space-y-4">
        <FormDialogSection cols={1} flat>
          <div>
            <Label htmlFor="ruta-origen">Puerto de origen *</Label>
            <PortIdSelect
              id="ruta-origen"
              value={origenId}
              onChange={elegirOrigen}
              placeholder="Buscar puerto de origen…"
              aria-invalid={origenInvalido || undefined}
            />
          </div>
          <div>
            <Label htmlFor="ruta-destino">Puerto de destino *</Label>
            <PortIdSelect
              id="ruta-destino"
              value={destinoId}
              onChange={setDestinoId}
              placeholder="Buscar puerto de destino…"
              excludeId={origenId}
              aria-invalid={destinoInvalido || undefined}
            />
          </div>
          {mismoPuerto && (
            <p className="text-body text-destructive" role="alert">
              El puerto de origen y el de destino deben ser distintos.
            </p>
          )}
          {mostrarDuplicada && (
            <p className="text-body text-destructive" role="alert">
              Esta ruta marítima ya está registrada. No necesitas volver a crearla.
            </p>
          )}
        </FormDialogSection>
      </form>
    </FormDialogShell>
  );
}
