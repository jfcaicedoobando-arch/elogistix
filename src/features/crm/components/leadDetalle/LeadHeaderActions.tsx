/**
 * Acciones del header de la ficha de lead.
 * Soporta dos modos de conversión:
 *  - Click rápido → onConvertirRapido (Sheet con 3 campos)
 *  - Menú "Más campos →" dentro del Sheet → onConvertirAvanzado (Dialog clásico)
 *
 * Ola 6 · O6.1: cuando el lead está sin asignar (bolsa común) y el usuario
 * tiene permiso de ventas, se ofrece "Tomar lead" (RPC crm_tomar_lead).
 */
import { BadgeCheck, Repeat, Trash2, UserCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
}: Props) {
  return (
    <div className="flex gap-2">
      {estado === "Convertido" ? <Badge variant="outline">Convertido</Badge> : null}
      {mostrarTomar && onTomar && (
        <Button variant="default" onClick={onTomar} disabled={tomando}>
          <UserCheck className="h-4 w-4 mr-1" />
          {tomando ? "Tomando…" : "Tomar lead"}
        </Button>
      )}
      {mostrarCalificar && onCalificar && (
        <Button variant="default" onClick={onCalificar} disabled={calificando}>
          <BadgeCheck className="h-4 w-4 mr-1" />
          {calificando ? "Calificando…" : "Calificar como prospecto"}
        </Button>
      )}
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
