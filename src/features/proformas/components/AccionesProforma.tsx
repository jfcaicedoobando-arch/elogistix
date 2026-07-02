/**
 * Barra de acciones del detalle de proforma.
 * Extraída de `ProformaDetalleCards.tsx` para mantener ≤200 líneas (Power of 10 #4).
 * Orquesta: Descargar PDF · Enviar al cliente · Aceptar/Rechazar manual ·
 * Ver embarque · Convertir a factura (gated por estado_cliente).
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import { Download, Ship, Loader2, FileText, Mail, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConvertirAFacturaDialog } from "@/features/proformas/components/ConvertirAFacturaDialog";
import { EnviarProformaDialog } from "@/features/proformas/components/EnviarProformaDialog";
import { RespuestaClienteManualDialog } from "@/features/proformas/components/RespuestaClienteManualDialog";
import type { ProformaDetalleFull } from "@/features/proformas/services";

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

export function AccionesProforma({ proforma, downloadingId, onDescargar }: Props) {
  const cargando = downloadingId === proforma.id;
  const [convertirOpen, setConvertirOpen] = useState(false);
  const [enviarOpen, setEnviarOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState<null | "aceptada" | "rechazada">(null);

  const facturada = (proforma.estado_proforma ?? "pendiente") === "facturada";
  const aprobada = (proforma.estado_revision ?? "") === "aprobada";
  const estadoCliente = readEstadoCliente(proforma);
  const clienteAcepto = estadoCliente === "aceptada";
  const puedeConvertir = aprobada && clienteAcepto && !facturada && !proforma.factura_id;
  const puedeResponder = !facturada && estadoCliente === "pendiente";

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" size="sm" disabled={cargando} onClick={onDescargar}>
        {cargando
          ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
          : <Download className="h-4 w-4 mr-1.5" />}
        Descargar PDF
      </Button>

      {!facturada && (
        <Button variant="outline" size="sm" onClick={() => setEnviarOpen(true)}>
          <Mail className="h-4 w-4 mr-1.5" /> Enviar al cliente
        </Button>
      )}

      {puedeResponder && (
        <>
          <Button variant="outline" size="sm" onClick={() => setManualOpen("aceptada")}>
            <CheckCircle2 className="h-4 w-4 mr-1.5 text-emerald-600" /> Aceptar (manual)
          </Button>
          <Button variant="outline" size="sm" onClick={() => setManualOpen("rechazada")}>
            <XCircle className="h-4 w-4 mr-1.5 text-red-600" /> Rechazar (manual)
          </Button>
        </>
      )}

      {proforma.embarque_id && (
        <Button variant="outline" size="sm" asChild>
          <Link to={`/embarques/${proforma.embarque_id}?tab=facturacion`}>
            <Ship className="h-4 w-4 mr-1.5" /> Ver embarque
          </Link>
        </Button>
      )}

      {puedeConvertir && (
        <>
          <Button size="sm" onClick={() => setConvertirOpen(true)}>
            <FileText className="h-4 w-4 mr-1.5" /> Convertir a factura
          </Button>
          <ConvertirAFacturaDialog
            open={convertirOpen}
            onOpenChange={setConvertirOpen}
            proformaIds={[proforma.id]}
            organizationId={proforma.organization_id}
            diasCreditoDefault={proforma.dias_credito ?? 0}
          />
        </>
      )}

      {aprobada && !clienteAcepto && !facturada && (
        <span className="text-xs text-muted-foreground self-center ml-1">
          Para facturar, el cliente debe aceptar la proforma.
        </span>
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
