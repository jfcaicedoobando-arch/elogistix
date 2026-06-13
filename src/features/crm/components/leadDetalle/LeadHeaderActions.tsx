/**
 * Acciones del header de la ficha de lead.
 * Soporta dos modos de conversión:
 *  - Click rápido → onConvertirRapido (Sheet con 3 campos)
 *  - Menú "Más campos →" dentro del Sheet → onConvertirAvanzado (Dialog clásico)
 */
import { Repeat, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { CrmLeadEstado } from "@/features/crm/hooks";

interface Props {
  estado: CrmLeadEstado;
  canEdit: boolean;
  onConvertir: () => void;
  onEliminar: () => void;
}

export default function LeadHeaderActions({ estado, canEdit, onConvertir, onEliminar }: Props) {
  return (
    <div className="flex gap-2">
      {estado === "Convertido" ? <Badge variant="outline">Convertido</Badge> : null}
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
