/**
 * Modales asociados a FacturaDetalle (pago, timbrado, envío, sustitución).
 * Extraído para reducir la complejidad ciclomática del route.
 */
import { DialogRegistrarPago } from "@/features/facturacion/components/DialogRegistrarPago";
import { DialogTimbrarFactura } from "@/features/facturacion/components/DialogTimbrarFactura";
import { DialogEnviarFacturaBranded } from "@/features/facturacion/components/DialogEnviarFacturaBranded";
import { DialogSustituirFactura } from "@/features/facturacion/components/DialogSustituirFactura";
import { DialogCancelarFactura } from "@/features/facturacion/components/DialogCancelarFactura";
import { DialogRefacturarReceptor } from "@/features/facturacion/components/refacturacion/DialogRefacturarReceptor";
import type { Factura } from "@/features/facturacion/types";

interface Props {
  factura: Pick<Factura, "id" | "numero" | "total" | "moneda" | "metodo_pago" | "uuid_fiscal" | "cliente_id" | "fecha_emision" | "rfc_cliente" | "estado">;
  pagoOpen: boolean;
  setPagoOpen: (v: boolean) => void;
  timbrarOpen: boolean;
  setTimbrarOpen: (v: boolean) => void;
  enviarOpen: boolean;
  setEnviarOpen: (v: boolean) => void;
  sustituirOpen: boolean;
  setSustituirOpen: (v: boolean) => void;
  cancelarOpen: boolean;
  setCancelarOpen: (v: boolean) => void;
  refacturarOpen: boolean;
  setRefacturarOpen: (v: boolean) => void;
}

export function FacturaDetalleModales(props: Props) {
  const { factura, pagoOpen, setPagoOpen, timbrarOpen, setTimbrarOpen,
    enviarOpen, setEnviarOpen, sustituirOpen, setSustituirOpen,
    cancelarOpen, setCancelarOpen, refacturarOpen, setRefacturarOpen } = props;
  return (
    <>
      <DialogRegistrarPago
        open={pagoOpen}
        onOpenChange={setPagoOpen}
        factura={{
          id: factura.id,
          numero: factura.numero,
          total: Number(factura.total),
          moneda: factura.moneda,
          metodoPago: factura.metodo_pago ?? null,
          uuidFiscal: factura.uuid_fiscal ?? null,
          fechaEmision: factura.fecha_emision ?? null,
          estado: factura.estado ?? null,
        }}
      />
      <DialogTimbrarFactura
        facturaId={timbrarOpen ? factura.id : null}
        open={timbrarOpen}
        onOpenChange={setTimbrarOpen}
      />
      <DialogEnviarFacturaBranded
        open={enviarOpen}
        onOpenChange={setEnviarOpen}
        factura={{
          id: factura.id,
          numero: factura.numero,
          cliente_id: factura.cliente_id ?? null,
          total: factura.total,
          moneda: factura.moneda,
        }}
      />
      <DialogSustituirFactura
        facturaId={sustituirOpen ? factura.id : null}
        numero={factura.numero}
        uuidOriginal={factura.uuid_fiscal ?? null}
        open={sustituirOpen}
        onOpenChange={setSustituirOpen}
      />
      <DialogCancelarFactura
        facturaId={cancelarOpen ? factura.id : null}
        numero={factura.numero}
        fechaEmision={factura.fecha_emision ?? null}
        total={factura.total !== null && factura.total !== undefined ? Number(factura.total) : null}
        rfcCliente={factura.rfc_cliente ?? null}
        open={cancelarOpen}
        onOpenChange={setCancelarOpen}
        onAbrirSustituir={() => { setCancelarOpen(false); setSustituirOpen(true); }}
      />
      <DialogRefacturarReceptor
        facturaId={refacturarOpen ? factura.id : null}
        open={refacturarOpen}
        onOpenChange={setRefacturarOpen}
      />
    </>
  );
}

