/**
 * FacturaDetalleActionsBar — construye las listas declarativas de acciones
 * (primary / secondary / more / destructive) que consume `DetalleActionBar`.
 *
 * Reglas por estado:
 * - Borrador: primary = Timbrar factura · destructivo = Eliminar borrador.
 * - Emitida con saldo: primary = Registrar pago (o Timbrar REP si hay REPs
 *   pendientes) · secondary = Enviar email + Descargar PDF.
 * - Emitida liquidada: primary = Enviar email · secondary = Descargar PDF.
 * - Cancelada/Sustituida: secondary = Descargar PDF + Acuse XML/PDF.
 * Descargas XML, Ver embarque, Sustituir/Cancelar CFDI y Reintentar acuse
 * viven en el menú "Más acciones" para no saturar el header.
 */
import {
  Stamp, Mail, FileText, FileCode2, Trash2, Replace, Ban,
  FileArchive, RefreshCw, HandCoins, SearchCheck, ExternalLink, Users,
} from "lucide-react";

import { DetalleActionBar, type DetalleActionItem } from "@/components/shared/DetalleActionBar";
import { usePermissions } from "@/hooks/shared/usePermissions";
import type { useAcuseCancelacion } from "@/features/facturacion/hooks/useAcuseCancelacion";
import type { deriveFacturaFlags } from "@/features/facturacion/domain/facturaFlags";
import type { FacturaDetalle } from "@/features/facturacion/services/detail";

type AcuseHandle = ReturnType<typeof useAcuseCancelacion>;
type Flags = ReturnType<typeof deriveFacturaFlags>;

interface Props {
  factura: FacturaDetalle;
  canEdit: boolean;
  /** R170-09: visibilidad/acción de "Timbrar factura" ligada al permiso
   * específico EMITIR_FACTURA_CLIENTE, no al `canEdit` genérico (evita que
   * roles operativos como coordinador logístico vean el botón). */
  puedeEmitir: boolean;
  flags: Flags;
  acuse: AcuseHandle;
  eliminando: boolean;
  puedeEliminarBorrador: boolean;
  timbrarRepPending?: boolean;
  onTimbrar: () => void;
  onEnviarEmail: () => void;
  onRegistrarPago: () => void;
  onTimbrarRep: () => void;
  onSustituir: () => void;
  onRefacturar: () => void;
  onCancelar: () => void;
  onEliminar: () => void;
  onConsultar: () => void;
  onDownload: (stored: string | null, tipo: "pdf" | "xml") => void;
}


function buildPrimary(props: Props): DetalleActionItem | null {
  const { flags, canEdit, puedeEmitir } = props;
  if (puedeEmitir && flags.puedeTimbrarDesdeSistema) {
    return { id: "timbrar", label: "Timbrar factura", icon: Stamp, onClick: props.onTimbrar };
  }
  // B-002 (v13.320.32): Cobrar tiene prioridad sobre "Timbrar REP" cuando hay saldo.
  // Antes, un REP pendiente/fallido escondía "Registrar pago" y bloqueaba la cobranza
  // indefinidamente. Ahora si hay saldo por cobrar, ese es el primary; el REP queda
  // accesible como acción secundaria.
  if (canEdit && flags.puedeRegistrarPago) {
    return { id: "cobrar", label: "Registrar pago", icon: HandCoins, onClick: props.onRegistrarPago };
  }
  if (canEdit && flags.repPendiente && !flags.estaCancelada) {
    return {
      id: "rep", label: "Timbrar REP", icon: Stamp,
      onClick: props.onTimbrarRep, loading: props.timbrarRepPending,
    };
  }
  if (!flags.sinTimbrar && !flags.estaCancelada) {
    return { id: "enviar", label: "Enviar por email", icon: Mail, onClick: props.onEnviarEmail };
  }
  return null;
}

function buildSecondary(props: Props, primaryId: string | null): DetalleActionItem[] {
  const { factura, flags, acuse } = props;
  const items: DetalleActionItem[] = [];
  const mostrarPdf = !!factura.factura_pdf_url || !flags.sinTimbrar;
  const mostrarXml = !!factura.factura_xml_url || !flags.sinTimbrar;

  if (!flags.sinTimbrar && !flags.estaCancelada && primaryId !== "enviar") {
    items.push({ id: "enviar", label: "Enviar por email", icon: Mail, onClick: props.onEnviarEmail });
  }
  if (mostrarPdf) {
    items.push({
      id: "pdf", label: "Descargar PDF", icon: FileText, iconClassName: "text-destructive",
      onClick: () => props.onDownload(factura.factura_pdf_url, "pdf"),
    });
  }
  if (flags.estaCancelada && !!factura.acuse_cancelacion_xml) {
    items.push({
      id: "acuse-xml", label: "Acuse XML", icon: FileCode2, iconClassName: "text-info",
      onClick: acuse.descargarXml,
    });
    items.push({
      id: "acuse-pdf", label: "Acuse PDF", icon: FileArchive, iconClassName: "text-destructive",
      onClick: acuse.descargarPdf,
    });
  }
  if (mostrarXml) {
    items.push({
      id: "xml", label: "Descargar XML", icon: FileCode2, iconClassName: "text-info",
      onClick: () => props.onDownload(factura.factura_xml_url, "xml"),
    });
  }
  return items;
}

function buildMore(
  props: Props,
  primaryId: string | null,
  puedeRefacturar: boolean,
): DetalleActionItem[] {
  const { factura, flags, acuse, canEdit } = props;
  const items: DetalleActionItem[] = [];
  // B-002 (v13.320.32): si el primary es "Registrar pago" pero hay REP pendiente,
  // el "Timbrar REP" sigue disponible aquí; y viceversa.
  if (canEdit && flags.repPendiente && !flags.estaCancelada && primaryId !== "rep") {
    items.push({
      id: "rep", label: "Timbrar REP", icon: Stamp,
      onClick: props.onTimbrarRep, loading: props.timbrarRepPending,
    });
  }
  if (canEdit && flags.puedeRegistrarPago && primaryId !== "cobrar") {
    items.push({ id: "cobrar", label: "Registrar pago", icon: HandCoins, onClick: props.onRegistrarPago });
  }
  // "Ver embarque" se retiró: el expediente del header ya es link clickable.
  if (factura.facturapi_id) {
    items.push({
      id: "consultar-facturapi", label: "Verificar estatus en FacturApi",
      icon: SearchCheck, onClick: props.onConsultar,
    });
  }
  if (factura.sustituida_por) {
    items.push({
      id: "ver-sustituta", label: "Ver factura sustituta", icon: ExternalLink,
      href: `/facturacion/${factura.sustituida_por}`,
    });
  }


  if (flags.puedeSustituirCfdi) {
    items.push({ id: "sustituir", label: "Sustituir CFDI", icon: Replace, onClick: props.onSustituir });
  }
  // Ola 12 — refacturación a otro receptor (cliente pagó desde otra empresa).
  // Aplica a cualquier CFDI timbrado y vivo, incluso ya cobrado ("Pagada").
  // Sólo roles contables y de administración (espejo de `_assert_refacturador`).
  if (flags.puedeRefacturarReceptor && puedeRefacturar) {
    items.push({
      id: "refacturar", label: "Refacturar a otro receptor", icon: Users,
      onClick: props.onRefacturar,
    });
  }
  if (flags.puedeCancelarCfdi) {
    items.push({
      id: "cancelar", label: "Cancelar CFDI", icon: Ban, destructive: true, onClick: props.onCancelar,
    });
  }
  if (flags.estaCancelada && factura.acuse_cancelacion_status !== "accepted") {
    items.push({
      id: "reintentar-acuse", label: "Reintentar acuse", icon: RefreshCw,
      onClick: acuse.reintentar, loading: acuse.reintentando,
    });
  }
  return items;
}

export function FacturaDetalleActionsBar(props: Props) {
  const { canOperarRefacturacion } = usePermissions();
  const primary = buildPrimary(props);
  const secondary = buildSecondary(props, primary?.id ?? null);
  const more = buildMore(props, primary?.id ?? null, canOperarRefacturacion);
  const destructive: DetalleActionItem | null = props.puedeEliminarBorrador
    ? {
        id: "eliminar-borrador", label: "Eliminar borrador", icon: Trash2,
        onClick: props.onEliminar, loading: props.eliminando,
      }
    : null;

  return (
    <DetalleActionBar
      primary={primary}
      secondary={secondary}
      more={more}
      destructive={destructive}
    />
  );
}
