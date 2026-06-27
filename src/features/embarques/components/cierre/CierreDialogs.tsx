/**
 * Diálogos de confirmación para cerrar/reabrir embarque.
 * Extraído de `TabCierre.tsx` (v13.139.12) para mantener archivos < 200 líneas.
 */
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { dialogSize } from "@/components/shared/utils/dialogTokens";
import { CIERRE_MOTIVO_MIN } from "@/features/embarques/hooks/useCierreDialog";

interface CerrarDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  confirmText: string;
  onConfirmTextChange: (v: string) => void;
  puedeConfirmar: boolean;
  isPending: boolean;
  onConfirm: () => void;
}

export function CerrarEmbarqueDialog({
  open,
  onOpenChange,
  confirmText,
  onConfirmTextChange,
  puedeConfirmar,
  isPending,
  onConfirm,
}: CerrarDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={dialogSize.md}>
        <DialogHeader>
          <DialogTitle>Confirmar cierre del embarque</DialogTitle>
          <DialogDescription>
            Esta acción es <strong>irreversible</strong> sin intervención de un super admin.
            Escribe <strong>CERRAR</strong> para confirmar.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="confirm-cerrar">Confirmación</Label>
          <Input
            id="confirm-cerrar"
            value={confirmText}
            onChange={(e) => onConfirmTextChange(e.target.value)}
            placeholder="CERRAR"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={!puedeConfirmar || isPending} onClick={onConfirm}>
            Cerrar embarque
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface ReabrirDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  motivo: string;
  onMotivoChange: (v: string) => void;
  puedeConfirmar: boolean;
  isPending: boolean;
  onConfirm: () => void;
}

export function ReabrirEmbarqueDialog({
  open,
  onOpenChange,
  motivo,
  onMotivoChange,
  puedeConfirmar,
  isPending,
  onConfirm,
}: ReabrirDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={dialogSize.md}>
        <DialogHeader>
          <DialogTitle>Reabrir embarque cerrado</DialogTitle>
          <DialogDescription>
            Describe el motivo (mínimo {CIERRE_MOTIVO_MIN} caracteres). Quedará registrado en bitácora.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="motivo-reapertura">Motivo</Label>
          <Textarea
            id="motivo-reapertura"
            value={motivo}
            onChange={(e) => onMotivoChange(e.target.value)}
            rows={4}
          />
          <p className="text-xs text-muted-foreground">
            {motivo.trim().length}/{CIERRE_MOTIVO_MIN} caracteres
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={!puedeConfirmar || isPending} onClick={onConfirm}>
            Reabrir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
