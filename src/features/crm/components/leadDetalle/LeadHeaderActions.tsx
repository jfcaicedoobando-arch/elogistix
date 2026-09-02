/**
 * Acciones del header de la ficha de lead.
 *
 * v13.823.63: se retiró el flujo heredado "Convertir lead" (puerta lateral que
 * podía crear oportunidad y marcar el lead como Convertido sin cliente). El
 * único camino es el canónico: perfil → calificar → oportunidad → cotización
 * aceptada → alta formal de cliente. Para leads históricos ya Convertidos sólo
 * queda "Ver conversión", de SÓLO LECTURA (nunca abre un diálogo mutante).
 *
 * Ola 6 · O6.1: cuando el lead está sin asignar (bolsa común) y el usuario
 * tiene permiso de ventas, se ofrece "Tomar lead" (RPC crm_tomar_lead).
 */
import { ExternalLink, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import LeadAccionesEtapa from "./LeadAccionesEtapa";
import { Button } from "@/components/ui/button";
import type { CrmLeadEstado } from "@/features/crm/hooks";

interface Props {
  estado: CrmLeadEstado;
  canEdit: boolean;
  onEliminar: () => void;
  /**
   * v13.823.63: sólo lectura. Se pasa únicamente cuando el lead está
   * Convertido y existe un destino real (oportunidad o cliente). No depende de
   * canEdit: consultar la conversión histórica no es una edición.
   */
  onVerConversion?: () => void;
  /** O6.1: el lead está en la bolsa (sin vendedor) y el usuario puede tomarlo. */
  mostrarTomar?: boolean;
  onTomar?: () => void;
  tomando?: boolean;
  /** Rediseño CRM (v13.766.0): gate Lead → Prospecto. */
  mostrarCalificar?: boolean;
  onCalificar?: () => void;
  calificando?: boolean;
  /** Fase 2 rediseño CRM: crear oportunidad desde el prospecto. */
  mostrarNuevaOportunidad?: boolean;
  onNuevaOportunidad?: () => void;
}

export default function LeadHeaderActions({
  estado,
  canEdit,
  onEliminar,
  onVerConversion,
  mostrarTomar = false,
  onTomar,
  tomando = false,
  mostrarCalificar = false,
  onCalificar,
  calificando = false,
  mostrarNuevaOportunidad = false,
  onNuevaOportunidad,
}: Props) {
  return (
    <div className="flex gap-2">
      {estado === "Convertido" ? <Badge variant="outline">Convertido</Badge> : null}
      <LeadAccionesEtapa
        mostrarTomar={mostrarTomar}
        onTomar={onTomar}
        tomando={tomando}
        mostrarCalificar={mostrarCalificar}
        onCalificar={onCalificar}
        calificando={calificando}
        mostrarNuevaOportunidad={mostrarNuevaOportunidad}
        onNuevaOportunidad={onNuevaOportunidad}
      />
      {estado === "Convertido" && onVerConversion && (
        <Button variant="outline" onClick={onVerConversion}>
          <ExternalLink className="h-4 w-4 mr-1" /> Ver conversión
        </Button>
      )}
      {canEdit && (
        <Button variant="destructive" onClick={onEliminar}>
          <Trash2 className="h-4 w-4 mr-1" /> Eliminar
        </Button>
      )}
    </div>
  );
}
