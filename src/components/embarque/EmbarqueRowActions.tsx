import { MoreHorizontal, Pencil, Copy, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { EmbarqueRow } from "@/hooks/embarque/useEmbarques";

interface Props {
  embarque: EmbarqueRow;
  onEditar: (e: EmbarqueRow) => void;
  onDuplicar: (e: EmbarqueRow) => void;
  onEliminar: (e: EmbarqueRow) => void;
}

export default function EmbarqueRowActions({ embarque, onEditar, onDuplicar, onEliminar }: Props) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild onClick={(ev) => ev.stopPropagation()}>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={(ev) => { ev.stopPropagation(); onEditar(embarque); }}>
          <Pencil className="mr-2 h-4 w-4" /> Editar
        </DropdownMenuItem>
        <DropdownMenuItem onClick={(ev) => { ev.stopPropagation(); onDuplicar(embarque); }}>
          <Copy className="mr-2 h-4 w-4" /> Duplicar
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onClick={(ev) => { ev.stopPropagation(); onEliminar(embarque); }}
        >
          <Trash2 className="mr-2 h-4 w-4" /> Eliminar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
