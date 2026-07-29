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
  Download, Ship, Receipt, Mail, CheckCircle2, XCircle, Link2, Eye,
} from "lucide-react";
import { DetalleActionBar, type DetalleActionItem } from "@/components/shared/DetalleActionBar";
import { EnviarProformaDialog } from "@/features/proformas/components/EnviarProformaDialog";
import { RespuestaClienteManualDialog } from "@/features/proformas/components/RespuestaClienteManualDialog";
import { AlertaLimiteCreditoDialog } from "@/features/proformas/components/AlertaLimiteCreditoDialog";
import { useConvertirProformaDirecto } from "@/features/proformas/hooks/useConvertirProformaDirecto";
import {
  useValidarLimiteCredito,
  registrarExcesoCredito,
  type ValidarLimiteResultado,
} from "@/features/cliente/hooks/useValidarLimiteCredito";
import type { ProformaDetalleFull } from "@/features/proformas/services";
import { usePermissions } from "@/hooks/shared";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";
import { resolverDiasCredito } from "@/features/proformas/domain/proformaDetalleHelpers";

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

function fmtMxn(v: number): string {
  return formatCurrency(v, "MXN");
}

export function AccionesProforma({ proforma, downloadingId, onDescargar }: Props) {
  const cargando = downloadingId === proforma.id;
  const [enviarOpen, setEnviarOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState<null | "aceptada" | "rechazada">(null);
  const [creditoAlerta, setCreditoAlerta] = useState<ValidarLimiteResultado | null>(null);
  const { canEmitirFactura, canResponderProformaManual } = usePermissions();
  const { convertir, isPending: convirtiendo } = useConvertirProformaDirecto();
  const validarLimite = useValidarLimiteCredito();

  const { facturada, puedeConvertir, puedeResponder, mostrarHint } = computarFlags(
    proforma,
    canEmitirFactura,
    canResponderProformaManual,
  );

  const ejecutarConversion = () =>
    convertir({
      proformaIds: [proforma.id],
      organizationId: proforma.organization_id,
      diasCredito: resolverDiasCredito(
        proforma.dias_credito,
        proforma.cliente_full?.dias_credito,
      ).dias ?? 0,
    });

  const onConvertir = async () => {
    if (!proforma.cliente_id) {
      ejecutarConversion();
      return;
    }
    try {
      const resultado = await validarLimite({
        clienteId: proforma.cliente_id,
        clienteNombre: proforma.cliente_nombre,
        montoAdicionalMxn: Number(proforma.total_mxn ?? 0),
      });
      if (resultado?.rebasa) {
        setCreditoAlerta(resultado);
        return;
      }
    } catch (err) {
      // Falla silenciosa: no bloqueamos la conversión por un error de validación.
      notifyError(undefined, { title: "No se pudo validar el límite de crédito", error: err });
    }
    ejecutarConversion();
  };

  const onConfirmarExceso = async () => {
    if (!creditoAlerta || !proforma.cliente_id) return;
    await registrarExcesoCredito({
      clienteId: proforma.cliente_id,
      clienteNombre: proforma.cliente_nombre,
      totalProyectadoMxn: creditoAlerta.totalProyectadoMxn,
      limiteMxn: creditoAlerta.exposicion.limiteMxn ?? 0,
      excedenteMxn: creditoAlerta.excedentePotencialMxn,
      origen: "proforma_convertir",
    });
    setCreditoAlerta(null);
    ejecutarConversion();
  };

  const primary: DetalleActionItem | null = puedeConvertir
    ? { id: "convertir", label: "Convertir a factura", icon: Receipt, onClick: onConvertir, loading: convirtiendo }
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
      id: "rechazar", label: "Rechazar (manual)", icon: XCircle, iconClassName: "text-destructive",
      onClick: () => setManualOpen("rechazada"),
    });
  }

  const more: DetalleActionItem[] = [];
  // SAFE-CAST: columna pública generada al enviar la proforma; los tipos
  // generados aún no la incluyen.
  const tokenPublico = (proforma as unknown as { token_publico?: string | null }).token_publico ?? null;
  if (tokenPublico) {
    const rutaPortal = `/portal/proformas/${tokenPublico}`;
    const ligaPortal = `${window.location.origin}${rutaPortal}`;
    more.push({
      id: "copiar-liga", label: "Copiar liga del portal", icon: Link2,
      onClick: () => {
        void navigator.clipboard.writeText(ligaPortal).then(
          () => notifySuccess(undefined, { title: "Liga del portal copiada" }),
          (err) => notifyError(undefined, { title: "No se pudo copiar la liga", error: err }),
        );
      },
    });
    more.push({ id: "ver-portal", label: "Ver como cliente", icon: Eye, href: rutaPortal });
  }
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
      <AlertaLimiteCreditoDialog
        resultado={creditoAlerta}
        clienteNombre={proforma.cliente_nombre}
        montoNuevaFactura={Number(proforma.total_mxn ?? 0)}
        onOpenChange={(o) => { if (!o) setCreditoAlerta(null); }}
        onConfirm={onConfirmarExceso}
      />
    </div>
  );
}
