import { DialogPagoLoteProveedor } from "@/features/cxp";
import { ProgramarPagoDialog } from "./ProgramarPagoDialog";
import type { LotePagoSeleccion } from "./cxpPorPagarList";

interface Props {
  isDialogOpen: boolean;
  onDialogOpenChange: (open: boolean) => void;
  selectedCount: number;
  fechaProgramada: string;
  onFechaChange: (fecha: string) => void;
  isRunning: boolean;
  progreso: { hecho: number; total: number } | null;
  onConfirmarProgramar: () => void;

  lote: LotePagoSeleccion | null;
  loteOpen: boolean;
  onLoteOpenChange: (open: boolean) => void;
  onLoteDone: () => void;
}

/**
 * Diálogos de CxP Por Pagar (programar pago y pago en lote). Extraído de
 * `CxpPorPagar` (Power of 10: archivos ≤200 líneas).
 */
export function CxpPorPagarDialogs({
  isDialogOpen,
  onDialogOpenChange,
  selectedCount,
  fechaProgramada,
  onFechaChange,
  isRunning,
  progreso,
  onConfirmarProgramar,
  lote,
  loteOpen,
  onLoteOpenChange,
  onLoteDone,
}: Props) {
  return (
    <>
      <ProgramarPagoDialog
        open={isDialogOpen}
        onOpenChange={onDialogOpenChange}
        cantidad={selectedCount}
        fechaProgramada={fechaProgramada}
        onFechaChange={onFechaChange}
        isRunning={isRunning}
        progreso={progreso}
        onConfirmar={onConfirmarProgramar}
      />

      {lote && (
        <DialogPagoLoteProveedor
          open={loteOpen}
          onOpenChange={onLoteOpenChange}
          proveedorId={lote.proveedorId}
          proveedorNombre={lote.proveedorNombre}
          proveedorOrigen={lote.proveedorOrigen}
          moneda={lote.moneda}
          facturas={lote.facturas}
          onDone={onLoteDone}
        />
      )}
    </>
  );
}
