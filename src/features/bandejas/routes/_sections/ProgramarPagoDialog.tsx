/**
 * Diálogo para programar pago en lote — extraído de CxpPorPagar.tsx (v13.317.9).
 */
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { DatePickerMx } from "@/components/ui/date-picker-mx";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  cantidad: number;
  fechaProgramada: string;
  onFechaChange: (v: string) => void;
  isRunning: boolean;
  progreso?: { hecho: number; total: number };
  onConfirmar: () => void;
}

export function ProgramarPagoDialog({
  open, onOpenChange, cantidad, fechaProgramada, onFechaChange, isRunning, progreso, onConfirmar,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Programar pago</DialogTitle>
          <DialogDescription>
            Selecciona la fecha en la que Tesorería deberá ejecutar el pago para las {cantidad} facturas seleccionadas.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label>Fecha de pago</Label>
            <DatePickerMx value={fechaProgramada} onChange={(v) => v && onFechaChange(v)} className="w-full" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isRunning}>Cancelar</Button>
          <Button onClick={onConfirmar} disabled={isRunning || !fechaProgramada}>
            {isRunning ? `Programando (${progreso?.hecho}/${progreso?.total})...` : "Confirmar programación"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
