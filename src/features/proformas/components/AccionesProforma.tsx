/**
 * Barra de acciones del detalle de proforma. Usa el componente compartido
 * `DetalleActionBar` para mantener el mismo design language que
 * `FacturaDetalle` y `TabFacturacion` del embarque.
 *
 * Acciones:
 * - primary: Convertir a factura (cuando el cliente aceptó y hay permiso).
 * - secondary: Descargar PDF · Enviar al cliente · Aceptar/Rechazar manual.
 * - more: Ver embarque (drilldown al expediente).
 */
import { useState } from "react";
import {
  Download, Ship, FileText, Mail, CheckCircle2, XCircle,
} from "lucide-react";
import { DetalleActionBar, type DetalleActionItem } from "@/components/shared/DetalleActionBar";
import { EnviarProformaDialog } from "@/features/proformas/components/EnviarProformaDialog";
import { RespuestaClienteManualDialog } from "@/features/proformas/components/RespuestaClienteManualDialog";
import { useConvertirProformaDirecto } from "@/features/proformas/hooks/useConvertirProformaDirecto";
import type { ProformaDetalleFull } from "@/features/proformas/services";
import { usePermissions } from "@/hooks/shared";

type EstadoCliente = "pendiente" | "aceptada" | "rechazada";

function readEstadoCliente(p: ProformaDetalleFull): EstadoCliente {
  // SAFE-CAST: columna nueva; los tipos generados aún no la incluyen.
  const raw = (p as unknown as { estado_cliente?: string }).estado_cliente;
  if (raw === "aceptada" || raw === "rechazada") return raw;
  return "pendiente";
}

interface Props {
  proforma: ProformaDetalleFull;
  downloadingId: string | null;
  onDescargar: () => void;
}

function computarFlags(
  proforma: ProformaDetalleFull,
  canEmitirFactura: boolean,
  canResponderProformaManual: boolean,
) {
  const facturada = (proforma.estado_proforma ?? "pendiente") === "facturada";
  const estadoCliente = readEstadoCliente(proforma);
  const clienteAcepto = estadoCliente === "aceptada";
  return {
    facturada,
    puedeConvertir:
      clienteAcepto && !facturada && !proforma.factura_id && canEmitirFactura,
    puedeResponder:
      !facturada && estadoCliente === "pendiente" && canResponderProformaManual,
    mostrarHint: !clienteAcepto && !facturada,
  };
}

export function AccionesProforma({ proforma, downloadingId, onDescargar }: Props) {
  const cargando = downloadingId === proforma.id;
  const [enviarOpen, setEnviarOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState<null | "aceptada" | "rechazada">(null);
  const { canEmitirFactura, canResponderProformaManual } = usePermissions();
  const { convertir, isPending: convirtiendo } = useConvertirProformaDirecto();

  const { facturada, puedeConvertir, puedeResponder, mostrarHint } = computarFlags(
    proforma,
    canEmitirFactura,
    canResponderProformaManual,
  );

  const onConvertir = () => convertir({
    proformaIds: [proforma.id],
    organizationId: proforma.organization_id,
    diasCredito: proforma.dias_credito ?? 0,
  });

  const primary: DetalleActionItem | null = puedeConvertir
    ? { id: "convertir", label: "Convertir a factura", icon: FileText, onClick: onConvertir, loading: convirtiendo }
    : null;

  const secondary: DetalleActionItem[] = [
    { id: "pdf", label: "Descargar PDF", icon: Download, onClick: onDescargar, loading: cargando },
  ];
  if (!facturada) {
    secondary.push({ id: "enviar", label: "Enviar al cliente", icon: Mail, onClick: () => setEnviarOpen(true) });
  }
  if (puedeResponder) {
    secondary.push({
      id: "aceptar", label: "Aceptar (manual)", icon: CheckCircle2, iconClassName: "text-success",
      onClick: () => setManualOpen("aceptada"),
    });
    secondary.push({
      id: "rechazar", label: "Rechazar (manual)", icon: XCircle, iconClassName: "text-red-600",
      onClick: () => setManualOpen("rechazada"),
    });
  }

  const more: DetalleActionItem[] = [];
  if (proforma.embarque_id) {
    more.push({
      id: "embarque", label: "Ver embarque", icon: Ship,
      href: `/embarques/${proforma.embarque_id}?tab=facturacion`,
    });
  }

  return (
    <div className="space-y-2">
      <DetalleActionBar primary={primary} secondary={secondary} more={more} />
      {mostrarHint && (
        <p className="text-xs text-muted-foreground">
          Para facturar, el cliente debe aceptar la proforma.
        </p>
      )}
      <EnviarProformaDialog open={enviarOpen} onOpenChange={setEnviarOpen} proforma={proforma} />
      {manualOpen && (
        <RespuestaClienteManualDialog
          open={!!manualOpen}
          onOpenChange={(o) => { if (!o) setManualOpen(null); }}
          proformaId={proforma.id}
          numero={proforma.numero ?? ""}
          modo={manualOpen}
        />
      )}
    </div>
  );
}
