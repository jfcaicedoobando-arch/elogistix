import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { dialogSize, scrollableDialog } from "@/components/shared/utils/dialogTokens";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import type { TablesInsert } from "@/types/db";
import { useNuevoProveedorController } from "@/hooks/proveedor";
import { NuevoProveedorStep1 } from "./NuevoProveedorStep1";
import { NuevoProveedorStep2 } from "./NuevoProveedorStep2";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: TablesInsert<"proveedores">) => void;
}

/**
 * Wizard de alta de proveedor en 2 pasos. Orquesta el controller y delega el
 * render de cada paso a `NuevoProveedorStep1` / `NuevoProveedorStep2` para
 * mantenerse ≤200 líneas (Power-of-10).
 */
export default function NuevoProveedorDialog({ open, onOpenChange, onSave }: Props) {
  const c = useNuevoProveedorController(onSave, () => onOpenChange(false));

  return (
    <Dialog open={open} onOpenChange={(abierto) => { if (!abierto) c.resetAndClose(); else onOpenChange(abierto); }}>
      <DialogContent className={cn(dialogSize.md, scrollableDialog)}>
        <DialogHeader>
          <DialogTitle>Nuevo Proveedor — Paso {c.step} de 2</DialogTitle>
        </DialogHeader>

        {c.step === 1 && <NuevoProveedorStep1 c={c} />}
        {c.step === 2 && <NuevoProveedorStep2 c={c} />}

        <DialogFooter>
          {c.step === 1 && (
            <>
              <Button variant="outline" onClick={c.resetAndClose}>Cancelar</Button>
              <Button onClick={c.handleNext} disabled={!c.isStep1Valid}>
                Siguiente <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </>
          )}
          {c.step === 2 && (
            <>
              <Button variant="outline" onClick={() => c.setStep(1)} disabled={c.saving}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Atrás
              </Button>
              <Button onClick={c.handleSave} disabled={c.saving}>
                {c.saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {c.saving ? "Guardando…" : "Crear"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
