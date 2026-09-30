import DoubleConfirmDeleteDialog from "@/components/shared/DoubleConfirmDeleteDialog";
import { DialogConsultarFacturapi } from "@/features/facturacion/components/detalle/DialogConsultarFacturapi";
import { DialogRecordatorioCobranza, type FacturaRecordatorio } from "@/features/cobranza/components/DialogRecordatorioCobranza";

interface Props {
  facturaId: string;
  numero: string;
  eliminarOpen: boolean;
  setEliminarOpen: (v: boolean) => void;
  eliminando: boolean;
  onEliminar: () => void;
  consultarOpen: boolean;
  setConsultarOpen: (v: boolean) => void;
  recordatorioOpen?: boolean;
  setRecordatorioOpen?: (v: boolean) => void;
  recordatorio?: FacturaRecordatorio | null;
}

/**
 * Diálogos que "flotan" al final del detalle de factura (borrar borrador +
 * verificar estatus FacturApi). Extraídos de FacturaDetalle.tsx para cumplir
 * el límite Power-of-10 de 200 líneas.
 */
export function FacturaDetalleFooterDialogs({
  facturaId, numero,
  eliminarOpen, setEliminarOpen, eliminando, onEliminar,
  consultarOpen, setConsultarOpen,
  recordatorioOpen = false, setRecordatorioOpen, recordatorio = null,
}: Props) {
  return (
    <>
      <DoubleConfirmDeleteDialog
        open={eliminarOpen}
        onOpenChange={setEliminarOpen}
        entityName={`borrador ${numero}`}
        description="Se dará de baja el borrador sin timbrar. Las proformas quedarán disponibles para convertir sólo si no tienen otra factura activa."
        finalDescription="El borrador y sus conceptos dejarán de estar activos, conservando su historial. No se cancela ni se elimina ningún CFDI timbrado."
        isPending={eliminando}
        onConfirm={onEliminar}
      />
      <DialogConsultarFacturapi
        facturaId={facturaId}
        numero={numero}
        open={consultarOpen}
        onOpenChange={setConsultarOpen}
      />
      {setRecordatorioOpen && (
        <DialogRecordatorioCobranza
          open={recordatorioOpen}
          onOpenChange={setRecordatorioOpen}
          factura={recordatorio}
        />
      )}
    </>
  );
}
