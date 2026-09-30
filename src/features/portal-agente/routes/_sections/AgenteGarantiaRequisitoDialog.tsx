import { Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import type { FilaNaviera } from "@/features/costeo/types/filaNaviera";

interface Props {
  seleccion: FilaNaviera | null;
  onOpenChange: (open: boolean) => void;
}

/** Explica el bloqueo sin presentar un formulario que no se puede completar. */
export function AgenteGarantiaRequisitoDialog({ seleccion, onOpenChange }: Props) {
  return (
    <FormDialogShell
      open={!!seleccion}
      onOpenChange={onOpenChange}
      icon={Info}
      title="Proveedor pendiente"
      description={seleccion ? `${seleccion.naviera_nombre} · ${seleccion.naviera_code}` : undefined}
      size="lg"
      footer={<Button variant="outline" onClick={() => onOpenChange(false)}>Entendido</Button>}
    >
      <p className="text-body">
        Pide a Operaciones que dé de alta el proveedor tipo &quot;Naviera&quot; correspondiente a
        {" "}<strong>{seleccion?.naviera_nombre}</strong> y lo vincule a sus condiciones.
      </p>
      <p className="text-body text-muted-foreground">
        Cuando el proveedor esté disponible, vuelve a abrir esta naviera para capturar la carta
        garantía, los días libres y el tabulador de demoras.
      </p>
    </FormDialogShell>
  );
}
