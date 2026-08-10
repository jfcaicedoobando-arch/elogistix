/**
 * Diálogos de confirmación del buzón de facturas entrantes del embarque.
 *
 * v13.494.0 — "Retirar del buzón" (borrado lógico + limpieza de storage) y
 * "Devolver a por capturar" (rescata un documento rechazado por error).
 */
import { ConfirmActionDialog } from "@/components/shared/dialogs/ConfirmActionDialog";
import type { FacturaEntranteRow } from "@/features/cxp/services/facturasEntrantes";

interface Props {
  aEliminar: FacturaEntranteRow | null;
  aReactivar: FacturaEntranteRow | null;
  onCerrarEliminar: () => void;
  onCerrarReactivar: () => void;
  onConfirmarEliminar: () => Promise<void>;
  onConfirmarReactivar: () => Promise<void>;
}

export function EntrantesConfirmDialogs({
  aEliminar,
  aReactivar,
  onCerrarEliminar,
  onCerrarReactivar,
  onConfirmarEliminar,
  onConfirmarReactivar,
}: Props) {
  return (
    <>
      <ConfirmActionDialog
        open={Boolean(aEliminar)}
        onOpenChange={(v) => { if (!v) onCerrarEliminar(); }}
        title="Retirar archivo del buzón"
        description="El PDF y el XML se eliminan del almacenamiento y dejan de estar disponibles para contabilidad. Esta acción no se puede deshacer."
        confirmLabel="Retirar"
        variant="destructive"
        onConfirm={onConfirmarEliminar}
      />

      <ConfirmActionDialog
        open={Boolean(aReactivar)}
        onOpenChange={(v) => { if (!v) onCerrarReactivar(); }}
        title="Devolver a 'Por capturar'"
        description="El documento volverá a la bandeja de Compras por capturar y se borrará el motivo de rechazo. Úsalo cuando el rechazo fue un error de captura y el archivo del proveedor sí es válido."
        confirmLabel="Devolver"
        onConfirm={onConfirmarReactivar}
      />
    </>
  );
}
