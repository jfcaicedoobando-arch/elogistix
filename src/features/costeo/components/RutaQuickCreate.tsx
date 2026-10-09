/**
 * Botón "+ Nueva ruta" debajo del campo Rutas en Nueva tarifa: abre el
 * diálogo de alta de rutas sin cerrar el formulario y selecciona la ruta
 * recién creada (mismo patrón que AgenteProvisionalDialog).
 */
import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RutaFormDialog } from "./RutaFormDialog";
import { useCosteoRutaMutations } from "@/features/costeo/hooks/useCosteoRutas";
import type { CosteoRuta } from "@/features/costeo/types";
import type { RutaOption } from "./MultiRutaSelect";

interface Props {
  rutas: RutaOption[];
  onCreada: (rutaId: string) => void;
}

export function RutaQuickCreate({ rutas, onCreada }: Props) {
  const [open, setOpen] = useState(false);
  const { crear } = useCosteoRutaMutations();
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="mt-1 h-7 px-1 text-label text-muted-foreground"
        onClick={() => setOpen(true)}
      >
        <Plus className="mr-1 size-3" /> Nueva ruta
      </Button>
      <RutaFormDialog
        open={open}
        onOpenChange={setOpen}
        crear={crear}
        // SAFE-CAST: en runtime son CosteoRuta completos (el selector sólo
        // proyecta el subconjunto RutaOption); el diálogo necesita los ids
        // de puertos para detectar duplicados.
        rutas={rutas as unknown as CosteoRuta[]}
        onCreada={onCreada}
      />
    </>
  );
}
