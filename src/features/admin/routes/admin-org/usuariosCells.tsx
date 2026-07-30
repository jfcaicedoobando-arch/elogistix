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
import type { EstadoInvitacion } from "@/features/admin/services/usuario";
import type { AppRole } from "@/types/appRole";
import {
  ASSIGNABLE_ROLE_GROUPS,
  ROLE_LABELS,
  ROLE_DESCRIPTIONS,
  esRolLegacy,
  rolModernoSugerido,
} from "@/features/admin/domain/roles/roleCatalog";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertTriangle, CheckCircle2, MailWarning } from "lucide-react";
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
        {esRolLegacy(user.role) && (
          <SelectGroup>
            <SelectLabel className="text-2xs uppercase tracking-wide text-warning-foreground">
              Rol legado (migrar)
            </SelectLabel>
            <SelectItem key={user.role} value={user.role} disabled>
              {ROLE_LABELS[user.role]}
            </SelectItem>
          </SelectGroup>
        )}
        {ASSIGNABLE_ROLE_GROUPS.map((group) => (
          <SelectGroup key={group.label}>
            <SelectLabel className="text-2xs uppercase tracking-wide text-muted-foreground">
              {group.label}
            </SelectLabel>
            {group.roles.map((r) => (
              <SelectItem key={r} value={r} className="items-start py-2">
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium">{ROLE_LABELS[r]}</span>
                  <span className="text-2xs leading-snug text-muted-foreground">
                    {ROLE_DESCRIPTIONS[r]}
                  </span>
                </div>
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}

/**
 * Q-05b — Estado de la cuenta: distingue una invitación pendiente
 * (usuario creado pero que nunca inició sesión) de una cuenta activa.
 */
export function EstadoInvitacionCell({ estado }: { estado: EstadoInvitacion }) {
  if (estado === "activo") {
    return (
      <Badge variant="outline" className="gap-1 border-emerald-500/40 text-emerald-700">
        <CheckCircle2 className="h-3 w-3" /> Activo
      </Badge>
    );
  }
  if (estado === "pendiente") {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className="gap-1 border-amber-500/40 text-amber-700">
            <MailWarning className="h-3 w-3" /> Invitación pendiente
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top">
          <p className="text-xs">El usuario aún no ha iniciado sesión ni confirmado su correo.</p>
        </TooltipContent>
      </Tooltip>
    );
  }
  return <span className="text-xs text-muted-foreground">—</span>;
}
