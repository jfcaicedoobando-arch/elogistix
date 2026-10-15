import { MoreHorizontal, KeyRound, UserMinus, Trash2, Ban, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { UserRow } from "@/features/admin/services/usuario";

export interface UsuarioRowActions {
  onResetPassword: (user: UserRow) => void;
  onQuitarDeOrg: (user: UserRow) => void;
  onDelete: (user: UserRow) => void;
  onCambiarAcceso: (user: UserRow, activo: boolean) => void;
}

/**
 * U-03: ciclo de vida de la cuenta. Antes la única acción era el borrado duro;
 * ahora se ofrece restablecer contraseña y quitar de la organización (sin
 * borrar el historial), dejando el borrado como acción destructiva final.
 */
export function UsuarioRowActionsCell({
  user,
  acciones,
}: {
  user: UserRow;
  acciones: UsuarioRowActions;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground"
          aria-label={`Acciones para ${user.email}`}
          onClick={(e) => e.stopPropagation()}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem onClick={() => acciones.onResetPassword(user)}>
          <KeyRound className="h-4 w-4" />
          Restablecer contraseña
        </DropdownMenuItem>
        {user.estado === "desactivado" ? (
          <DropdownMenuItem onClick={() => acciones.onCambiarAcceso(user, true)}>
            <UserCheck className="size-4" />
            Reactivar acceso
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onClick={() => acciones.onCambiarAcceso(user, false)}>
            <Ban className="size-4" />
            Desactivar acceso
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={() => acciones.onQuitarDeOrg(user)}>
          <UserMinus className="h-4 w-4" />
          Quitar de la organización
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onClick={() => acciones.onDelete(user)}
        >
          <Trash2 className="h-4 w-4" />
          Eliminar cuenta
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
