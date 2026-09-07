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
import { Receipt } from "lucide-react";
import { DetalleActionBar, type DetalleActionItem } from "@/components/shared/DetalleActionBar";
import {
  buildSecondaryItems,
  buildMoreItems,
} from "@/features/proformas/components/accionesProformaItems";
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
import { useClienteAutorizacion } from "@/features/cliente/hooks/useClienteAutorizacion";
import { useAprobarProformaInterna } from "@/features/proformas/hooks/useAprobarProformaInterna";
import { BadgeClienteDeCasa } from "@/components/shared/BadgeClienteDeCasa";
import {
  computarFlags,
  readEstadoCliente,
} from "@/features/proformas/components/accionesProformaFlags";

interface Props {
  proforma: ProformaDetalleFull;
  downloadingId: string | null;
  onDescargar: () => void;
}

export function AccionesProforma({ proforma, downloadingId, onDescargar }: Props) {
  const cargando = downloadingId === proforma.id;
  const [enviarOpen, setEnviarOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState<null | "aceptada" | "rechazada">(null);
  const [creditoAlerta, setCreditoAlerta] = useState<ValidarLimiteResultado | null>(null);
  const { canEmitirFactura, canResponderProformaManual, canEditarProforma } = usePermissions();
  const { convertir, isPending: convirtiendo } = useConvertirProformaDirecto();
  const validarLimite = useValidarLimiteCredito();
  const { autorizacion } = useClienteAutorizacion(proforma.cliente_id ?? null);
  const { aprobar: aprobarInterna, isPending: aprobando } = useAprobarProformaInterna();

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

  // v13.624.0 — cliente de casa: aprobación interna en un clic (sin diálogo de
  // "respuesta del cliente", porque no hay respuesta que registrar).
  const puedeAprobarInterna =
    !autorizacion.requiereAutorizacionProforma &&
    !facturada &&
    readEstadoCliente(proforma) === "pendiente" &&
    canResponderProformaManual;

  const secondary = buildSecondaryItems({
    facturada,
    cargando,
    aprobando,
    puedeAprobarInterna,
    puedeResponder,
    // VF-20: el vendedor (sólo lectura) no ve la acción de envío.
    puedeEnviar: canEditarProforma,
    onDescargar,
    onEnviar: () => setEnviarOpen(true),
    onAprobarInterna: () => aprobarInterna(proforma.id),
    onAceptarManual: () => setManualOpen("aceptada"),
    onRechazarManual: () => setManualOpen("rechazada"),
  });

  // SAFE-CAST: columna pública generada al enviar la proforma; los tipos
  // generados aún no la incluyen.
  const tokenPublico = (proforma as unknown as { token_publico?: string | null }).token_publico ?? null;
  const more = buildMoreItems({
    tokenPublico,
    embarqueId: proforma.embarque_id ?? null,
    onCopiarLiga: (liga) => {
      void navigator.clipboard.writeText(liga).then(
        () => notifySuccess(undefined, { title: "Liga del portal copiada" }),
        (err) => notifyError(undefined, { title: "No se pudo copiar la liga", error: err }),
      );
    },
  });

  return (
    <div className="space-y-2">
      <DetalleActionBar primary={primary} secondary={secondary} more={more} />
      {!autorizacion.requiereAutorizacionProforma && <BadgeClienteDeCasa tipo="proforma" />}
      {mostrarHint && (
        <p className="text-body-sm text-muted-foreground">
          {autorizacion.requiereAutorizacionProforma
            ? "Para facturar, el cliente debe aceptar la proforma."
            : canResponderProformaManual
              ? "Este cliente no requiere autorización: aprueba la proforma internamente para facturarla."
              : "Este cliente no requiere autorización. Pide a un administrador o gerente que la apruebe internamente para poder facturarla."}
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
