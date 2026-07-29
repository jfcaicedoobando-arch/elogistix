/**
 * DialogTimbrarFactura — Revisión previa al timbrado CFDI 4.0.
 * Migrado a `FormDialogShell` (v13.120.0). El estado y el handler viven
 * en `useTimbrarFacturaDialog` para respetar el límite de 200 líneas.
 * vO7 — queries al hook `useTimbradoContext` y footer a componente propio;
 * se elimina el `eslint-disable complexity`.
 */
import { Stamp } from "lucide-react";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { buildEstadoTimbrado } from "@/features/facturacion/utils/estadoTimbrado";
import { useTimbrarFacturaDialog } from "@/features/facturacion/hooks/useTimbrarFacturaDialog";
import { useTimbradoContext } from "@/features/facturacion/hooks/useTimbradoContext";
import { TimbrarCompacto, TimbrarCompleto } from "./DialogTimbrarFactura.parts";
import { DialogTimbrarFacturaFooter } from "./DialogTimbrarFacturaFooter";
import { ReferenciasEmbarquePreview } from "./ReferenciasEmbarquePreview";

interface Props {
  facturaId: string | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

export function DialogTimbrarFactura({ facturaId, open, onOpenChange }: Props) {
  const { factura, cliente, defaults } = useTimbradoContext(facturaId);
  const dlg = useTimbrarFacturaDialog(factura, cliente, defaults, () => onOpenChange(false));

  if (!facturaId || !factura) return null;

  const { checks, puedeTimbrar, esFastPath } = buildEstadoTimbrado(factura, cliente, {
    usoCfdi: dlg.usoCfdi,
    formaPago: dlg.formaPago,
    metodoPago: dlg.metodoPago,
  });

  const mostrarCompacto = esFastPath && !dlg.modoExpandido;

  return (
    <FormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={Stamp}
      title={`Timbrar factura ${factura.numero}`}
      description={
        mostrarCompacto
          ? "Todo listo para emitir el CFDI 4.0 vía Facturapi."
          : "Revisa los datos fiscales antes de emitir el CFDI 4.0 a través de Facturapi."
      }
      size={mostrarCompacto ? "md" : "lg"}
      footer={
        <DialogTimbrarFacturaFooter
          mostrarCompacto={mostrarCompacto}
          puedeTimbrar={puedeTimbrar}
          timbrando={dlg.timbrarPending}
          onExpandir={() => dlg.setModoExpandido(true)}
          onCancelar={() => onOpenChange(false)}
          onConfirm={dlg.onConfirm}
        />
      }
    >
      {mostrarCompacto ? (
        <TimbrarCompacto
          usoCfdi={dlg.usoCfdi}
          formaPago={dlg.formaPago}
          metodoPago={dlg.metodoPago}
          enviarEmail={dlg.enviarEmail}
          setEnviarEmail={dlg.setEnviarEmail}
        />
      ) : (
        <TimbrarCompleto
          checks={checks}
          usoCfdi={dlg.usoCfdi}
          setUsoCfdi={dlg.setUsoCfdi}
          formaPago={dlg.formaPago}
          setFormaPago={dlg.setFormaPago}
          metodoPago={dlg.metodoPago}
          setMetodoPago={dlg.setMetodoPago}
          enviarEmail={dlg.enviarEmail}
          setEnviarEmail={dlg.setEnviarEmail}
          puedeTimbrar={puedeTimbrar}
        />
      )}
      <ReferenciasEmbarquePreview factura={factura} />
    </FormDialogShell>
  );
}
