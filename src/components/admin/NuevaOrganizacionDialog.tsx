import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { dialogSize } from "@/lib/ui/dialogTokens";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  nombre: string;
  onNombreChange: (v: string) => void;
  rfc: string;
  onRfcChange: (v: string) => void;
  onCreate: () => void;
  isPending: boolean;
}

export function NuevaOrganizacionDialog({
  open,
  onOpenChange,
  nombre,
  onNombreChange,
  rfc,
  onRfcChange,
  onCreate,
  isPending,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={dialogSize.md}>
        <DialogHeader>
          <DialogTitle>Nueva Organización</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Nombre *</Label>
            <Input
              value={nombre}
              onChange={(e) => onNombreChange(e.target.value)}
              placeholder="Nombre de la empresa"
            />
          </div>
          <div>
            <Label>RFC</Label>
            <Input
              value={rfc}
              onChange={(e) => onRfcChange(e.target.value)}
              placeholder="RFC (opcional)"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={onCreate} disabled={!nombre.trim() || isPending}>
            Crear
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
