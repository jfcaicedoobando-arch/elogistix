/**
 * DialogTimbrarFactura — Revisión previa al timbrado CFDI 4.0.
 * Migrado a `FormDialogShell` (v13.120.0). El estado y el handler viven
 * en `useTimbrarFacturaDialog` para respetar el límite de 200 líneas.
 * vO7 — queries al hook `useTimbradoContext` y footer a componente propio;
 * se elimina el `eslint-disable complexity`.
 */
import { rfcReceptorFactura } from "@/lib/financial/usoCfdiFiscal";
import { AlertTriangle, Stamp } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FormDialogShell } from "@/components/shared/FormDialogShell";

import { buildEstadoTimbrado } from "@/features/facturacion/utils/estadoTimbrado";
import { useTimbrarFacturaDialog } from "@/features/facturacion/hooks/useTimbrarFacturaDialog";
import { useTimbradoContext } from "@/features/facturacion/hooks/useTimbradoContext";
import { useConceptosFactura } from "@/features/facturacion/hooks/useConceptosFactura";
import { TimbrarCompacto, TimbrarCompleto } from "./DialogTimbrarFactura.parts";
import { DialogTimbrarFacturaFooter } from "./DialogTimbrarFacturaFooter";
import { ReferenciasEmbarquePreview } from "./ReferenciasEmbarquePreview";
import { TimbradoResumen } from "./TimbradoConfirmacion";

interface Props {
  facturaId: string | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

function vistaCompactaDisponible(esFastPath: boolean, expandido: boolean, guardando: boolean) {
  return esFastPath && !expandido && !guardando;
}

function AvisoAutosave({ pendiente, error }: { pendiente: boolean; error: boolean }) {
  if (error) return <Alert variant="destructive"><AlertDescription>Hay datos fiscales sin guardar. Vuelve a Conceptos y reintenta el guardado antes de timbrar.</AlertDescription></Alert>;
  if (!pendiente) return null;
  return <Alert><AlertDescription>Guardando los datos fiscales elegidos. Espera a que termine antes de timbrar.</AlertDescription></Alert>;
}

export function DialogTimbrarFactura({ facturaId, open, onOpenChange }: Props) {
  const { factura, cliente, defaults, ambiente, emailDestino } = useTimbradoContext(facturaId);
  const dlg = useTimbrarFacturaDialog(factura, cliente, defaults, () => onOpenChange(false), { emailDestino, open });
  // P1 · Auditoría IVA — se necesitan los conceptos para detectar PPD + No objeto.
  const { data: conceptos } = useConceptosFactura(facturaId ?? undefined);

  if (!facturaId || !factura) return null;

  const { checks, puedeTimbrar, esFastPath, advertencias } = buildEstadoTimbrado(
    factura,
    cliente,
    { usoCfdi: dlg.usoCfdi, formaPago: dlg.formaPago, metodoPago: dlg.metodoPago },
    conceptos,
  );


  const mostrarCompacto = vistaCompactaDisponible(esFastPath, dlg.modoExpandido, dlg.datosFiscalesSinGuardar);
  const ambienteDisponible = ambiente === "sandbox" || ambiente === "live";

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
          puedeTimbrar={puedeTimbrar && ambienteDisponible && !dlg.datosFiscalesSinGuardar}
          timbrando={dlg.timbrarPending}
          onExpandir={() => dlg.setModoExpandido(true)}
          onCancelar={() => onOpenChange(false)}
          onConfirm={dlg.onConfirm}
        />
      }
    >
      <AvisoAutosave pendiente={dlg.datosFiscalesPending} error={dlg.datosFiscalesError} />
      <TimbradoResumen ambiente={ambiente} cliente={factura.cliente_nombre ?? "Cliente no disponible"} rfc={rfcReceptorFactura(factura.rfc_cliente, cliente?.rfc)} total={Number(factura.total)} moneda={factura.moneda} />
      {mostrarCompacto ? (
        <TimbrarCompacto
          usoCfdi={dlg.usoCfdi}
          formaPago={dlg.formaPago}
          metodoPago={dlg.metodoPago}
          enviarEmail={dlg.enviarEmail}
          setEnviarEmail={dlg.setEnviarEmail}
          emailDestino={emailDestino}
        />
      ) : (
        <TimbrarCompleto
          checks={checks}
          receptor={{ rfc: rfcReceptorFactura(factura.rfc_cliente, cliente?.rfc), regimen: cliente?.regimen_fiscal ?? "" }}
          usoCfdi={dlg.usoCfdi}
          setUsoCfdi={dlg.setUsoCfdi}
          formaPago={dlg.formaPago}
          setFormaPago={dlg.setFormaPago}
          metodoPago={dlg.metodoPago}
          setMetodoPago={dlg.setMetodoPago}
          enviarEmail={dlg.enviarEmail}
          setEnviarEmail={dlg.setEnviarEmail}
          emailDestino={emailDestino}
          puedeTimbrar={puedeTimbrar}
        />
      )}
      {advertencias.map((texto) => (
        <Alert key={texto} variant="warning" role="alert">
          <AlertTriangle className="h-4 w-4" aria-hidden />
          <AlertDescription>{texto}</AlertDescription>
        </Alert>
      ))}
      <ReferenciasEmbarquePreview factura={factura} />

    </FormDialogShell>
  );
}
