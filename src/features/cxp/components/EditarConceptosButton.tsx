/**
 * Botón "Editar conceptos" del detalle de factura de proveedor (v13.628.0).
 * Sólo se habilita en facturas capturadas a mano, sin pagos y no canceladas;
 * cuando no aplica, explica el motivo en el tooltip.
 */
import { useState } from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DialogEditarConceptosFactura } from "@/features/cxp/components/DialogEditarConceptosFactura";
import { evaluarEdicionConceptos } from "@/features/cxp/utils/conceptosEditables";

interface Props {
  facturaId: string;
  folio: string;
  moneda: string;
  subtotal: number;
  uuidFiscal: string | null;
  archivoXmlUrl: string | null;
  estado: string;
  pagado: number;
}

export function EditarConceptosButton(props: Props) {
  const [open, setOpen] = useState(false);
  const { puede, motivo } = evaluarEdicionConceptos({
    uuid_fiscal: props.uuidFiscal,
    archivo_xml_url: props.archivoXmlUrl,
    estado: props.estado,
    pagado: props.pagado,
  });

  const boton = (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={!puede}
      onClick={() => setOpen(true)}
    >
      <Pencil className="mr-1.5 h-3.5 w-3.5" />
      Editar conceptos
    </Button>
  );

  return (
    <>
      {puede ? boton : (
        <Tooltip>
          <TooltipTrigger asChild><span className="inline-flex">{boton}</span></TooltipTrigger>
          <TooltipContent className="max-w-xs text-body-sm">{motivo}</TooltipContent>
        </Tooltip>
      )}
      {puede && (
        <DialogEditarConceptosFactura
          open={open}
          onOpenChange={setOpen}
          facturaId={props.facturaId}
          folio={props.folio}
          moneda={props.moneda}
          subtotal={props.subtotal}
        />
      )}
    </>
  );
}
