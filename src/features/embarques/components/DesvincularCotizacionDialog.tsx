import { useState } from "react";
import { dialogSize } from "@/components/shared/utils/dialogTokens";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

export type DesvincularOpcion = "conservar" | "solo-conceptos" | "limpiar";

interface DesvincularCotizacionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cotizacionFolio?: string;
  onConfirm: (opcion: DesvincularOpcion) => void;
}

/**
 * Diálogo para desvincular una cotización del wizard de embarques.
 * Ofrece tres opciones (v13.28.0):
 *   - conservar: rompe vínculo pero deja todos los datos heredados.
 *   - solo-conceptos: deja datos generales y limpia sólo los conceptos
 *     de venta/costo que se trajeron de la cotización.
 *   - limpiar: borra todo lo heredado y vuelve al estado inicial.
 */
export function DesvincularCotizacionDialog({
  open, onOpenChange, cotizacionFolio, onConfirm,
}: DesvincularCotizacionDialogProps) {
  const [opcion, setOpcion] = useState<DesvincularOpcion>("conservar");

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className={dialogSize.sm}>
        <AlertDialogHeader>
          <AlertDialogTitle>Desvincular cotización</AlertDialogTitle>
          <AlertDialogDescription>
            {cotizacionFolio
              ? <>Vas a desvincular la cotización <strong>{cotizacionFolio}</strong> del embarque. Elige qué hacer con los datos ya heredados:</>
              : <>Vas a desvincular la cotización del embarque. Elige qué hacer con los datos ya heredados:</>}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <RadioGroup
          value={opcion}
          onValueChange={(v) => setOpcion(v as DesvincularOpcion)}
          className="space-y-3 py-2"
        >
          <label htmlFor="op-conservar" className="flex items-start gap-3 rounded-md border p-3 cursor-pointer hover:bg-muted/40">
            <RadioGroupItem value="conservar" id="op-conservar" className="mt-1" />
            <div className="space-y-1">
              <Label htmlFor="op-conservar" className="font-medium cursor-pointer">Conservar datos</Label>
              <p className="text-sm text-muted-foreground">Mantiene cliente, ruta, mercancía y conceptos. Sólo se rompe el vínculo con la cotización.</p>
            </div>
          </label>

          <label htmlFor="op-solo-conceptos" className="flex items-start gap-3 rounded-md border p-3 cursor-pointer hover:bg-muted/40">
            <RadioGroupItem value="solo-conceptos" id="op-solo-conceptos" className="mt-1" />
            <div className="space-y-1">
              <Label htmlFor="op-solo-conceptos" className="font-medium cursor-pointer">Limpiar sólo conceptos</Label>
              <p className="text-sm text-muted-foreground">Conserva datos generales y ruta, pero quita los conceptos de venta y costo heredados.</p>
            </div>
          </label>

          <label htmlFor="op-limpiar" className="flex items-start gap-3 rounded-md border p-3 cursor-pointer hover:bg-muted/40">
            <RadioGroupItem value="limpiar" id="op-limpiar" className="mt-1" />
            <div className="space-y-1">
              <Label htmlFor="op-limpiar" className="font-medium cursor-pointer">Limpiar todo lo heredado</Label>
              <p className="text-sm text-muted-foreground">Borra cliente, ruta, mercancía y conceptos pre-llenados. El embarque queda en blanco.</p>
            </div>
          </label>
        </RadioGroup>

        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={() => onConfirm(opcion)}>Desvincular</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

