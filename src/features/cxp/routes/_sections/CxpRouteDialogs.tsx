/**
 * Bloque de diálogos de Cxp — extraído para respetar el límite de 200 líneas (v13.317.9).
 */
import { DialogNuevaFacturaProveedor } from "@/features/cxp/components/DialogNuevaFacturaProveedor";
import { DialogEditarFacturaProveedor } from "@/features/cxp/components/DialogEditarFacturaProveedor";
import { DialogRegistrarPagoProveedor } from "@/features/cxp/components/DialogRegistrarPagoProveedor";
import { DialogDetallePagosProveedor } from "@/features/cxp/components/DialogDetallePagosProveedor";
import { EliminarFacturaCxpDialog } from "@/features/cxp/components/EliminarFacturaCxpDialog";
import type { FacturaCxP } from "@/features/cxp/services";
import type { useCxpPageState } from "@/features/cxp/hooks";

interface Props {
  f: ReturnType<typeof useCxpPageState>;
  data: FacturaCxP[];
  canEdit: boolean;
  isPendingEliminar: boolean;
  onEliminar: (fact: FacturaCxP) => void;
  onConfirmEliminar: () => Promise<void>;
}

export function CxpRouteDialogs({
  f, data, canEdit, isPendingEliminar, onEliminar, onConfirmEliminar,
}: Props) {
  return (
    <>
      <DialogNuevaFacturaProveedor open={f.openNueva} onOpenChange={f.setOpenNueva} />
      <DialogEditarFacturaProveedor
        factura={f.editar ? data.find((d) => d.id === f.editar!.id) ?? f.editar : null}
        onOpenChange={(o) => !o && f.setEditar(null)}
      />
      <DialogRegistrarPagoProveedor
        open={!!f.pagar}
        onOpenChange={(o) => !o && f.setPagar(null)}
        factura={f.pagar ? data.find((d) => d.id === f.pagar!.id) ?? f.pagar : null}
      />
      <DialogDetallePagosProveedor
        open={!!f.detalle}
        onOpenChange={(o) => !o && f.setDetalle(null)}
        factura={f.detalle ? data.find((d) => d.id === f.detalle!.id) ?? f.detalle : null}
        canEdit={canEdit}
        onPagar={(fact) => { f.setDetalle(null); f.setPagar(fact); }}
        onEditar={(fact) => { f.setDetalle(null); f.setEditar(fact); }}
        onEliminar={(fact) => { f.setDetalle(null); onEliminar(fact); }}
      />
      <EliminarFacturaCxpDialog
        factura={f.aEliminar}
        onOpenChange={(o) => !o && f.setAEliminar(null)}
        isPending={isPendingEliminar}
        onConfirm={onConfirmEliminar}
      />
    </>
  );
}
