import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Pencil, Trash2, UserPlus } from "lucide-react";
import { toTitleCase } from "@/lib/formatters";
import type { AgenteRow } from "./CosteoAgentesTable";

export function CosteoAgenteMobileCard({ agente, onEditar, onInvitarPortal, onEliminar }: {
  agente: AgenteRow;
  onEditar: () => void;
  onInvitarPortal: () => void;
  onEliminar: () => void;
}) {
  return (
    <div className="flex items-start gap-3">
      <div
        role="button"
        tabIndex={0}
        aria-label={`Editar ${agente.nombre}`}
        onClick={onEditar}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onEditar();
          }
        }}
        className="min-w-0 flex-1 space-y-1 cursor-pointer rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold text-body break-words">{toTitleCase(agente.nombre) || "—"}</p>
          <Badge variant={agente.activo ? "default" : "neutral"}>{agente.activo ? "Activo" : "Inactivo"}</Badge>
        </div>
        <p className="text-body-sm text-muted-foreground">{agente.pais ?? "País no registrado"} · {agente.dias_credito ?? "—"} días de crédito</p>
        <p className="text-body-sm break-all">{toTitleCase(agente.contacto_tarifario ?? "") || "Sin contacto"}</p>
        {agente.email && <p className="text-label text-muted-foreground break-all">{agente.email}</p>}
      </div>
       <div onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
         <DropdownMenu>
           <DropdownMenuTrigger asChild>
             <Button size="icon" variant="outline" aria-label={`Acciones para ${agente.nombre}`}>
               <MoreHorizontal className="size-4" />
             </Button>
           </DropdownMenuTrigger>
           <DropdownMenuContent align="end" className="w-52" onClick={(e) => e.stopPropagation()}>
             <DropdownMenuItem onClick={onEditar}>
               <Pencil className="mr-2 size-4" />Editar
             </DropdownMenuItem>
             <DropdownMenuItem onClick={onInvitarPortal}>
               <UserPlus className="mr-2 size-4" />Invitar al portal
             </DropdownMenuItem>
             <DropdownMenuSeparator />
             <DropdownMenuItem onClick={onEliminar} className="text-destructive focus:text-destructive">
               <Trash2 className="mr-2 size-4" />Eliminar
             </DropdownMenuItem>
           </DropdownMenuContent>
         </DropdownMenu>
       </div>
    </div>
  );
}