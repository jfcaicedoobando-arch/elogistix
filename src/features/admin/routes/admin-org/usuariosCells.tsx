import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { UserRow } from "@/features/admin/hooks/usuario";
import type { AppRole } from "@/types/appRole";
import {
  ASSIGNABLE_ROLE_GROUPS,
  ROLE_LABELS,
  esRolLegacy,
  rolModernoSugerido,
} from "@/features/admin/domain/roles/roleCatalog";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertTriangle } from "lucide-react";
import { inicialesDeEmail } from "./usuariosCellsUtils";


interface UsuarioCellProps {
  user: UserRow;
  isSelf: boolean;
}

/** Celda "Usuario": avatar + email + chip "Tú". */
export function UsuarioCell({ user, isSelf }: UsuarioCellProps) {
  const unresolved = user.email === "No disponible";
  return (
    <div className="flex items-center gap-3">
      <Avatar className="h-8 w-8 shrink-0 md:h-9 md:w-9">
        <AvatarFallback className="bg-muted text-label font-semibold text-muted-foreground">
          {inicialesDeEmail(user.email)}
        </AvatarFallback>
      </Avatar>
      <div className="flex min-w-0 flex-col">
        <span
          className={
            unresolved
              ? "italic font-normal text-muted-foreground truncate"
              : "font-medium truncate"
          }
        >
          {user.email}
        </span>
        {isSelf && (
          <span className="text-2xs uppercase tracking-wide text-primary font-semibold">
            Tú
          </span>
        )}
        {esRolLegacy(user.role) && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge
                  variant="outline"
                  className="mt-0.5 w-fit gap-1 border-warning/60 bg-warning/10 text-2xs uppercase tracking-wide text-warning-foreground"
                >
                  <AlertTriangle className="h-3 w-3" />
                  Rol legado
                </Badge>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs text-xs">
                Este usuario aún tiene el rol legacy <strong>{user.role}</strong>. Cámbialo a{" "}
                <strong>{ROLE_LABELS[rolModernoSugerido(user.role) ?? "customer_service"]}</strong>{" "}
                o ejecuta la migración desde <em>Auditoría de plataforma → Migración de roles legacy</em>.
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
    </div>
  );
}

interface ChangeRoleCellProps {
  user: UserRow;
  isSelf: boolean;
  onPendingRole: (user: UserRow, newRole: AppRole) => void;
}

/** Celda "Cambiar rol": select agrupado por área. */
export function ChangeRoleCell({ user, isSelf, onPendingRole }: ChangeRoleCellProps) {
  return (
    <Select
      value={user.role}
      disabled={isSelf}
      onValueChange={(val) => {
        const newRole = val as AppRole;
        if (newRole === user.role) return;
        onPendingRole(user, newRole);
      }}
    >
      <SelectTrigger className="w-full min-w-[160px] sm:min-w-[180px] lg:min-w-[220px] max-w-[260px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {ASSIGNABLE_ROLE_GROUPS.map((group) => (
          <SelectGroup key={group.label}>
            <SelectLabel className="text-2xs uppercase tracking-wide text-muted-foreground">
              {group.label}
            </SelectLabel>
            {group.roles.map((r) => (
              <SelectItem key={r} value={r}>
                {ROLE_LABELS[r]}
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}
