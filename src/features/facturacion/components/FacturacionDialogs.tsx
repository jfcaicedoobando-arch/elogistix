/**
 * Bundle de diálogos del módulo Facturación.
 *
 * v13.172.12: se removieron los diálogos DialogRegistrarPago,
 * DialogHistorialPagos, DialogTimbrarFactura y DialogCancelarFactura de
 * la lista. Ahora se disparan desde el detalle de la factura
 * (`/facturacion/:id`). Aquí sólo queda el alta manual, que sí es una
 * acción de listado (crear una factura nueva desde cero).
 */
import { DialogNuevaFacturaManual } from "@/features/facturacion/components/DialogNuevaFacturaManual";

interface Props {
  openFacturaManual: boolean;
  setOpenFacturaManual: (o: boolean) => void;
}

export function FacturacionDialogs({ openFacturaManual, setOpenFacturaManual }: Props) {
  return (
    <DialogNuevaFacturaManual
      open={openFacturaManual}
      onOpenChange={setOpenFacturaManual}
    />
  );
}
