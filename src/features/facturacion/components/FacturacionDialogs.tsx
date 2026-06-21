/**
 * Bundle de diálogos del módulo Facturación.
 * Extraído de `Facturacion.tsx` para mantenerlo < 200 LOC.
 */
import { DialogRegistrarPago } from "@/features/facturacion/components/DialogRegistrarPago";
import { DialogHistorialPagos } from "@/features/facturacion/components/DialogHistorialPagos";
import { DialogTimbrarFactura } from "@/features/facturacion/components/DialogTimbrarFactura";
import { DialogCancelarFactura } from "@/features/facturacion/components/DialogCancelarFactura";
import { DialogNuevaFacturaManual } from "@/features/facturacion/components/DialogNuevaFacturaManual";
import type { Factura } from "@/features/facturacion/routes/facturacionColumns";

interface Props {
  pagoFactura: Factura | null;
  setPagoFactura: (f: Factura | null) => void;
  historialFactura: Factura | null;
  setHistorialFactura: (f: Factura | null) => void;
  timbrarFactura: Factura | null;
  setTimbrarFactura: (f: Factura | null) => void;
  cancelarFactura: Factura | null;
  setCancelarFactura: (f: Factura | null) => void;
  openFacturaManual: boolean;
  setOpenFacturaManual: (o: boolean) => void;
  canEdit: boolean;
}

export function FacturacionDialogs({
  pagoFactura, setPagoFactura,
  historialFactura, setHistorialFactura,
  timbrarFactura, setTimbrarFactura,
  cancelarFactura, setCancelarFactura,
  openFacturaManual, setOpenFacturaManual,
  canEdit,
}: Props) {
  return (
    <>
      <DialogRegistrarPago
        open={!!pagoFactura}
        onOpenChange={(o) => !o && setPagoFactura(null)}
        factura={pagoFactura}
      />
      <DialogHistorialPagos
        open={!!historialFactura}
        onOpenChange={(o) => !o && setHistorialFactura(null)}
        factura={historialFactura}
        canEdit={canEdit}
      />
      <DialogTimbrarFactura
        facturaId={timbrarFactura?.id ?? null}
        open={!!timbrarFactura}
        onOpenChange={(o) => !o && setTimbrarFactura(null)}
      />
      <DialogCancelarFactura
        facturaId={cancelarFactura?.id ?? null}
        numero={cancelarFactura?.numero}
        open={!!cancelarFactura}
        onOpenChange={(o) => !o && setCancelarFactura(null)}
      />
      <DialogNuevaFacturaManual
        open={openFacturaManual}
        onOpenChange={setOpenFacturaManual}
      />
    </>
  );
}
