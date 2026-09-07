/**
 * Acción principal ("primary") de la barra del detalle de factura.
 * Vive fuera del componente para que el archivo de UI sólo exporte
 * componentes (regla react-refresh/only-export-components).
 */
import { Stamp, Mail, HandCoins } from "lucide-react";

import type { DetalleActionItem } from "@/components/shared/DetalleActionBar";
import type { useAcuseCancelacion } from "@/features/facturacion/hooks/useAcuseCancelacion";
import type { deriveFacturaFlags } from "@/features/facturacion/domain/facturaFlags";
import type { FacturaDetalle } from "@/features/facturacion/services/detail";

export type AcuseHandle = ReturnType<typeof useAcuseCancelacion>;
export type FacturaActionsFlags = ReturnType<typeof deriveFacturaFlags>;

export interface FacturaActionsBarProps {
  factura: FacturaDetalle;
  canEdit: boolean;
  /** R170-09: visibilidad/acción de "Timbrar factura" ligada al permiso
   * específico EMITIR_FACTURA_CLIENTE, no al `canEdit` genérico (evita que
   * roles operativos como coordinador logístico vean el botón). */
  puedeEmitir: boolean;
  flags: FacturaActionsFlags;
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

export function buildPrimary(props: FacturaActionsBarProps): DetalleActionItem | null {
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
