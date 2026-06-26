/**
 * Modales asociados a FacturaDetalle (pago, timbrado, envío, sustitución).
 * Extraído para reducir la complejidad ciclomática del route.
 */
import { DialogRegistrarPago } from "@/features/facturacion/components/DialogRegistrarPago";
import { DialogTimbrarFactura } from "@/features/facturacion/components/DialogTimbrarFactura";
import { DialogEnviarCfdi } from "@/features/facturacion/components/DialogEnviarCfdi";
import { DialogSustituirFactura } from "@/features/facturacion/components/DialogSustituirFactura";
import type { Tables } from "@/integrations/supabase/types";

type Factura = Tables<"facturas">;

interface Props {
  factura: Pick<Factura, "id" | "numero" | "total" | "moneda" | "metodo_pago" | "uuid_fiscal">;
  pagoOpen: boolean;
  setPagoOpen: (v: boolean) => void;
  timbrarOpen: boolean;
  setTimbrarOpen: (v: boolean) => void;
  enviarOpen: boolean;
  setEnviarOpen: (v: boolean) => void;
  sustituirOpen: boolean;
  setSustituirOpen: (v: boolean) => void;
}

export function FacturaDetalleModales(props: Props) {
  const { factura, pagoOpen, setPagoOpen, timbrarOpen, setTimbrarOpen,
    enviarOpen, setEnviarOpen, sustituirOpen, setSustituirOpen } = props;
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
        }}
      />
      <DialogTimbrarFactura
        facturaId={timbrarOpen ? factura.id : null}
        open={timbrarOpen}
        onOpenChange={setTimbrarOpen}
      />
      <DialogEnviarCfdi
        open={enviarOpen}
        onOpenChange={setEnviarOpen}
        facturaId={factura.id}
        titulo={`Enviar CFDI ${factura.numero}`}
      />
      <DialogSustituirFactura
        facturaId={sustituirOpen ? factura.id : null}
        numero={factura.numero}
        uuidOriginal={factura.uuid_fiscal ?? null}
        open={sustituirOpen}
        onOpenChange={setSustituirOpen}
      />
    </>
  );
}
