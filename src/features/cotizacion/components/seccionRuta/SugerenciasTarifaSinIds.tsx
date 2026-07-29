/**
 * Empty-state de `SugerenciasTarifaInline` cuando origen/destino/tipo aún no
 * resuelven a IDs del catálogo. Extraído para bajar la complejidad ciclomática.
 */
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BuscarTarifaDialog } from "@/features/costeo/components/BuscarTarifaDialog";
import type { TopTarifaRow } from "@/features/costeo/types";

interface Props {
  openDialog: boolean;
  setOpenDialog: (open: boolean) => void;
  onElegir: (row: TopTarifaRow) => void;
  puertoOrigenId?: string | null;
  puertoDestinoId?: string | null;
  tipoContenedorId?: string | null;
}

export function SugerenciasTarifaSinIds({ openDialog, setOpenDialog, onElegir, puertoOrigenId, puertoDestinoId, tipoContenedorId }: Props) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-md border border-dashed p-3">
      <p className="text-sm text-muted-foreground">
        Selecciona origen, destino y tipo de contenedor para ver tarifas.
      </p>
      <Button type="button" size="sm" variant="default" onClick={() => setOpenDialog(true)}>
        <Search className="size-4 mr-2" /> Buscar tarifa
      </Button>
      <BuscarTarifaDialog
        open={openDialog}
        onOpenChange={setOpenDialog}
        onElegir={onElegir}
        selectLabel="Usar esta tarifa"
        initial={{
          puertoOrigenId: puertoOrigenId ?? undefined,
          puertoDestinoId: puertoDestinoId ?? undefined,
          tipoContenedorId: tipoContenedorId ?? undefined,
        }}
      />
    </div>
  );
}
