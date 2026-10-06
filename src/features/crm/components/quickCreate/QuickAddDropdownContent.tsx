/**
 * Contenido del DropdownMenu de "+ Nuevo" del CRM.
 * Extraído de `QuickAddMenu` para mantenerlo compacto.
 */
import { Building2, UserRound, Target, Activity, Upload } from "lucide-react";
import {
  DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

interface Props {
  canCrearLead: boolean;
  canCrearOportunidad: boolean;
  canCrearActividad: boolean;
  canGestionarLeadsEnLote: boolean;
  onEmpresa: () => void;
  onContacto: () => void;
  onOportunidad: () => void;
  onActividad: () => void;
  onImportar: () => void;
}

export default function QuickAddDropdownContent({
  canCrearLead, canCrearOportunidad, canCrearActividad, canGestionarLeadsEnLote,
  onEmpresa, onContacto, onOportunidad, onActividad, onImportar,
}: Props) {
  return (
    <DropdownMenuContent align="end" className="w-56">
      {canCrearLead && (
        <>
          <DropdownMenuItem onSelect={onEmpresa}>
            <Building2 className="h-4 w-4 mr-2" /> Nueva empresa
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onContacto}>
            <UserRound className="h-4 w-4 mr-2" /> Nuevo contacto
          </DropdownMenuItem>
        </>
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
