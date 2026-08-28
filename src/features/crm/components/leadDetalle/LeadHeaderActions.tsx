/**
 * Acciones del header de la ficha de lead.
 * Soporta dos modos de conversión:
 *  - Click rápido → onConvertirRapido (Sheet con 3 campos)
 *  - Menú "Más campos →" dentro del Sheet → onConvertirAvanzado (Dialog clásico)
 *
 * Ola 6 · O6.1: cuando el lead está sin asignar (bolsa común) y el usuario
 * tiene permiso de ventas, se ofrece "Tomar lead" (RPC crm_tomar_lead).
 */
import { Repeat, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import LeadAccionesEtapa from "./LeadAccionesEtapa";
import { Button } from "@/components/ui/button";
import type { CrmLeadEstado } from "@/features/crm/hooks";

interface Props {
  estado: CrmLeadEstado;
  canEdit: boolean;
  onConvertir: () => void;
  onEliminar: () => void;
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
  onConvertir,
  onEliminar,
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
      {canEdit && (
        <Button variant="outline" onClick={onConvertir}>
          <Repeat className="h-4 w-4 mr-1" />
          {estado === "Convertido" ? "Ver conversión" : "Convertir"}
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
