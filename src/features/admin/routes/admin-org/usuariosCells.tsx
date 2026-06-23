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
} from "@/features/admin/domain/roles/roleCatalog";

/** Iniciales (2 chars) a partir del email. Fallback: "?". */
export function inicialesDeEmail(email: string): string {
  if (!email || email === "No disponible") return "?";
  const local = email.split("@")[0] ?? email;
  const parts = local.split(/[._-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return local.slice(0, 2).toUpperCase();
}

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
        <AvatarFallback className="bg-muted text-[11px] font-semibold text-muted-foreground">
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
          <span className="text-[10px] uppercase tracking-wide text-primary font-semibold">
            Tú
          </span>
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
            <SelectLabel className="text-[10px] uppercase tracking-wide text-muted-foreground">
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
