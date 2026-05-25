/**
 * Acciones del header de la ficha de lead (convertir + eliminar + badge).
 * Extraído de `pages/crm/LeadDetalle.tsx`.
 */
import { Repeat, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { CrmLeadEstado } from "@/hooks/crm";

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
