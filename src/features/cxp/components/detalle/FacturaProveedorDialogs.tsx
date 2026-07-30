/**
 * Diálogos de la página de factura de proveedor (pagar, editar, eliminar,
 * cerrar sin pago, cancelar y eliminar pago).
 */
import { DialogEditarFacturaProveedor } from "@/features/cxp/components/DialogEditarFacturaProveedor";
import { DialogRegistrarPagoProveedor } from "@/features/cxp/components/DialogRegistrarPagoProveedor";
import { EliminarFacturaCxpDialog } from "@/features/cxp/components/EliminarFacturaCxpDialog";
import { ActionDialogs } from "@/features/cxp/components/DialogDetallePagosProveedor.actiondialogs";
import type { FacturaCxP } from "@/features/cxp/services";

type ActionDialogsProps = Parameters<typeof ActionDialogs>[0];

interface Props {
  factura: FacturaCxP;
  pagarOpen: boolean;
  setPagarOpen: (o: boolean) => void;
  editarOpen: boolean;
  setEditarOpen: (o: boolean) => void;
  eliminarOpen: boolean;
  setEliminarOpen: (o: boolean) => void;
  eliminando: boolean;
  onConfirmEliminar: () => Promise<void>;
  acciones: Omit<ActionDialogsProps, "f">;
}

export function FacturaProveedorDialogs({
  factura, pagarOpen, setPagarOpen, editarOpen, setEditarOpen,
  eliminarOpen, setEliminarOpen, eliminando, onConfirmEliminar, acciones,
}: Props) {
  return (
    <>
      <DialogRegistrarPagoProveedor
        open={pagarOpen}
        onOpenChange={setPagarOpen}
        factura={pagarOpen ? factura : null}
      />
      <DialogEditarFacturaProveedor
        factura={editarOpen ? factura : null}
        onOpenChange={(o) => !o && setEditarOpen(false)}
      />
      <EliminarFacturaCxpDialog
        factura={eliminarOpen ? factura : null}
        onOpenChange={(o) => !o && setEliminarOpen(false)}
        isPending={eliminando}
        onConfirm={onConfirmEliminar}
      />
      <ActionDialogs f={factura} {...acciones} />
    </>
  );
}
