import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Users } from "lucide-react";
import {
  ASSIGNABLE_ROLE_GROUPS,
  ROLE_LABELS,
} from "@/features/admin/domain/roles/roleCatalog";

export const TODOS = "todos" as const;

interface UsuariosToolbarProps {
  busqueda: string;
  onBusquedaChange: (v: string) => void;
  filtroRol: string;
  onFiltroRolChange: (v: string) => void;
  totalFiltrados: number;
  total: number;
  rolesPresentes: number;
  /** U-06: filtro por estado de la cuenta. */
  filtroEstado: string;
  onFiltroEstadoChange: (v: string) => void;
}

/**
 * Barra superior de la tabla de usuarios: buscador + filtro por rol +
 * contador. Extraído de `Usuarios.tsx` para mantenerlo ≤200 líneas.
 */
export function UsuariosToolbar({
  busqueda,
  onBusquedaChange,
  filtroRol,
  onFiltroRolChange,
  totalFiltrados,
  total,
  rolesPresentes,
  filtroEstado,
  onFiltroEstadoChange,
}: UsuariosToolbarProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-sm">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por correo…"
            value={busqueda}
            onChange={(e) => onBusquedaChange(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={filtroRol} onValueChange={onFiltroRolChange}>
          <SelectTrigger className="sm:w-[220px]">
            <SelectValue placeholder="Filtrar por rol" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todos los roles</SelectItem>
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
        <Select value={filtroEstado} onValueChange={onFiltroEstadoChange}>
          <SelectTrigger className="sm:w-[200px]" aria-label="Filtrar por estado">
            <SelectValue placeholder="Filtrar por estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todos los estados</SelectItem>
            <SelectItem value="activo">Activos</SelectItem>
            <SelectItem value="pendiente">Invitación pendiente</SelectItem>
            <SelectItem value="legacy">Rol legado</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Users className="h-4 w-4" />
        <span>
          <strong className="text-foreground">{totalFiltrados}</strong> de {total} usuario
          {total === 1 ? "" : "s"} · {rolesPresentes} rol{rolesPresentes === 1 ? "" : "es"}
        </span>
      </div>
    </div>
  );
}
