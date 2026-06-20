import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getRoleLabel } from "@/lib/ui/uiMappings";

interface Props {
  search: string;
  onSearchChange: (v: string) => void;
  orgFilter: string;
  onOrgChange: (v: string) => void;
  roleFilter: string;
  onRoleChange: (v: string) => void;
  orgs: string[];
  roles: string[];
}

export function AdminUsuariosFilters({
  search,
  onSearchChange,
  orgFilter,
  onOrgChange,
  roleFilter,
  onRoleChange,
  orgs,
  roles,
}: Props) {
  return (
    <div className="flex flex-col sm:flex-row gap-2">
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Buscar por email…"
          className="pl-8"
          aria-label="Buscar usuarios"
        />
      </div>
      <Select value={orgFilter} onValueChange={onOrgChange}>
        <SelectTrigger className="w-full sm:w-[200px]" aria-label="Filtrar por organización">
          <SelectValue placeholder="Organización" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="todos">Todas las organizaciones</SelectItem>
          {orgs.map((o) => (
            <SelectItem key={o} value={o}>{o}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={roleFilter} onValueChange={onRoleChange}>
        <SelectTrigger className="w-full sm:w-[160px]" aria-label="Filtrar por rol">
          <SelectValue placeholder="Rol" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="todos">Todos los roles</SelectItem>
          {roles.map((r) => (
            <SelectItem key={r} value={r}>{getRoleLabel(r)}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
