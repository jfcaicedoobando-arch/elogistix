/**
 * Constructores de los items de la barra de acciones de proforma.
 * Se extraen del componente para bajar su complejidad (Power-of-10).
 */
import { Download, Ship, Mail, CheckCircle2, XCircle, Link2, Eye } from "lucide-react";
import type { DetalleActionItem } from "@/components/shared/DetalleActionBar";

export interface SecondaryParams {
  facturada: boolean;
  cargando: boolean;
  aprobando: boolean;
  puedeAprobarInterna: boolean;
  puedeResponder: boolean;
  /** VF-20: roles de sólo lectura (ej. vendedor) no ven "Enviar al cliente". */
  puedeEnviar: boolean;
  onDescargar: () => void;
  onEnviar: () => void;
  onAprobarInterna: () => void;
  onAceptarManual: () => void;
  onRechazarManual: () => void;
}

export function buildSecondaryItems(p: SecondaryParams): DetalleActionItem[] {
  const items: DetalleActionItem[] = [
    { id: "pdf", label: "Descargar PDF", icon: Download, onClick: p.onDescargar, loading: p.cargando },
  ];
  if (!p.facturada && p.puedeEnviar) {
    items.push({ id: "enviar", label: "Enviar al cliente", icon: Mail, onClick: p.onEnviar });
  }
  if (p.puedeAprobarInterna) {
    items.push({
      id: "aprobar-interna",
      label: "Aprobar internamente",
      icon: CheckCircle2,
      iconClassName: "text-success",
      loading: p.aprobando,
      onClick: p.onAprobarInterna,
    });
    return items;
  }
  if (p.puedeResponder) {
    items.push({
      id: "aceptar", label: "Aceptar (manual)", icon: CheckCircle2,
      iconClassName: "text-success", onClick: p.onAceptarManual,
    });
    items.push({
      id: "rechazar", label: "Rechazar (manual)", icon: XCircle,
      iconClassName: "text-destructive", onClick: p.onRechazarManual,
    });
  }
  return items;
}

export interface MoreParams {
  tokenPublico: string | null;
  embarqueId: string | null;
  onCopiarLiga: (liga: string) => void;
}

export function buildMoreItems(p: MoreParams): DetalleActionItem[] {
  const items: DetalleActionItem[] = [];
  if (p.tokenPublico) {
    const rutaPortal = `/portal/proformas/${p.tokenPublico}`;
    const ligaPortal = `${window.location.origin}${rutaPortal}`;
    items.push({
      id: "copiar-liga", label: "Copiar liga del portal", icon: Link2,
      onClick: () => p.onCopiarLiga(ligaPortal),
    });
    items.push({ id: "ver-portal", label: "Ver como cliente", icon: Eye, href: rutaPortal });
  }
  if (p.embarqueId) {
    items.push({
      id: "embarque", label: "Ver embarque", icon: Ship,
      href: `/embarques/${p.embarqueId}?tab=facturacion`,
    });
  }
  return items;
}
