import { useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Search } from "lucide-react";
import { useDialogBolContainers } from "@/hooks/embarque/useDialogBolContainers";
import { BolContainersResult } from "./dialogBol/BolContainersResult";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  embarqueId: string;
  blMaster: string | null;
  naviera: string | null;
  contenedorActual: string | null;
}

export function DialogBolContainers({
  open,
  onOpenChange,
  embarqueId,
  blMaster,
  naviera,
  contenedorActual,
}: Props) {
  const ctrl = useDialogBolContainers({
    embarqueId,
    naviera,
    contenedorActual,
    onClose: () => onOpenChange(false),
  });

  useEffect(() => {
    if (open) ctrl.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, contenedorActual]);

  const containers = ctrl.result?.ok ? ctrl.result.associated_container_numbers ?? [] : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Contenedores del BL Master</DialogTitle>
          <DialogDescription>
            Consulta JSONCargo para listar los contenedores asociados al BL{" "}
            <span className="font-mono">{blMaster ?? "—"}</span> y selecciona el de este embarque.
          </DialogDescription>
        </DialogHeader>

        {!ctrl.result && (
          <div className="py-4">
            <Button onClick={ctrl.handleBuscar} disabled={ctrl.lookupPending} className="w-full">
              {ctrl.lookupPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Search className="h-4 w-4 mr-2" />
              )}
              Buscar contenedores
            </Button>
          </div>
        )}

        {ctrl.result && (
          <BolContainersResult
            result={ctrl.result}
            selected={ctrl.selected}
            setSelected={ctrl.setSelected}
            contenedorActual={contenedorActual}
            onRetry={ctrl.handleBuscar}
            loading={ctrl.lookupPending}
          />
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={ctrl.saving}>
            Cancelar
          </Button>
          {ctrl.result?.ok && containers.length > 0 && (
            <Button
              onClick={ctrl.handleGuardar}
              disabled={!ctrl.selected || ctrl.saving}
            >
              {ctrl.saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Guardar y sincronizar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
