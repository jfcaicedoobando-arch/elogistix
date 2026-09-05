/**
 * Contenido del DropdownMenu de "+ Nuevo" del CRM.
 * Extraído de `QuickAddMenu` para mantenerlo compacto.
 */
import { Users, Target, Activity, Upload } from "lucide-react";
import {
  DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

interface Props {
  canCrearLead: boolean;
  canCrearOportunidad: boolean;
  canCrearActividad: boolean;
  canGestionarLeadsEnLote: boolean;
  onLead: () => void;
  onOportunidad: () => void;
  onActividad: () => void;
  onImportar: () => void;
}

export default function QuickAddDropdownContent({
  canCrearLead, canCrearOportunidad, canCrearActividad, canGestionarLeadsEnLote,
  onLead, onOportunidad, onActividad, onImportar,
}: Props) {
  return (
    <DropdownMenuContent align="end" className="w-56">
      {canCrearLead && (
        <DropdownMenuItem onSelect={onLead}>
          <Users className="h-4 w-4 mr-2" /> Nuevo lead <span className="ml-auto text-label text-muted-foreground">L</span>
        </DropdownMenuItem>
      )}
      {canCrearOportunidad && (
        <DropdownMenuItem onSelect={onOportunidad}>
          <Target className="h-4 w-4 mr-2" /> Nueva oportunidad <span className="ml-auto text-label text-muted-foreground">O</span>
        </DropdownMenuItem>
      )}
      {canCrearActividad && (
        <DropdownMenuItem onSelect={onActividad}>
          <Activity className="h-4 w-4 mr-2" /> Nueva actividad <span className="ml-auto text-label text-muted-foreground">A</span>
        </DropdownMenuItem>
      )}
      {canGestionarLeadsEnLote && (
        <>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={onImportar}>
            <Upload className="h-4 w-4 mr-2" /> Importar leads CSV
          </DropdownMenuItem>
        </>
      )}
    </DropdownMenuContent>
  );
}
