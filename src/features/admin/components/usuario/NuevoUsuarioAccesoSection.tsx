import { Building2, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ASSIGNABLE_ROLE_GROUPS,
  ROLE_BADGE_CLASSES,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
} from "@/features/admin/domain/roles/roleCatalog";
import type { AppRole } from "@/types/appRole";

interface OrgOption {
  id: string;
  nombre: string;
}

interface AccesoSectionProps {
  role: AppRole;
  onRoleChange: (role: AppRole) => void;
  showOrgSelector: boolean;
  orgId: string;
  onOrgIdChange: (id: string) => void;
  orgs: OrgOption[];
}

/**
 * Sección "Acceso" del modal de nuevo usuario: organización (opcional) +
 * selector de rol agrupado + tarjeta de preview del rol elegido.
 *
 * El SelectValue se renderiza plano (sólo label) para evitar el desborde
 * vertical que tenía cuando el SelectItem multilinea se pintaba dentro
 * del trigger.
 */
export function NuevoUsuarioAccesoSection({
  role,
  onRoleChange,
  showOrgSelector,
  orgId,
  onOrgIdChange,
  orgs,
}: AccesoSectionProps) {
  return (
    <section className="space-y-3">
      <h4 className="text-overline font-semibold">
        Acceso
      </h4>

      {showOrgSelector && (
        <div className="space-y-1.5">
          <Label className="flex items-center gap-1.5">
            <Building2 className="h-3.5 w-3.5" /> Organización
          </Label>
          <Select value={orgId} onValueChange={onOrgIdChange}>
            <SelectTrigger>
              <SelectValue placeholder="Selecciona organización" />
            </SelectTrigger>
            <SelectContent>
              {orgs.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-1.5">
        <Label className="flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5" /> Rol
        </Label>
        <Select value={role} onValueChange={(v) => onRoleChange(v as AppRole)}>
          <SelectTrigger>
            <SelectValue>{ROLE_LABELS[role]}</SelectValue>
          </SelectTrigger>
          <SelectContent className="max-h-96 w-[var(--radix-select-trigger-width)]">
            {ASSIGNABLE_ROLE_GROUPS.map((group, gi) => (
              <div key={group.label}>
                {gi > 0 && <SelectSeparator />}
                <SelectGroup>
                  <SelectLabel className="text-label uppercase tracking-wide text-muted-foreground">
                    {group.label}
                  </SelectLabel>
                  {group.roles.map((r) => (
                    <SelectItem key={r} value={r}>
                      <div className="flex flex-col py-0.5">
                        <span className="font-medium">{ROLE_LABELS[r]}</span>
                        <span className="text-xs text-muted-foreground line-clamp-2">
                          {ROLE_DESCRIPTIONS[r]}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectGroup>
              </div>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Vista previa del rol seleccionado */}
      <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
        <Badge className={`${ROLE_BADGE_CLASSES[role]} whitespace-nowrap`}>
          {ROLE_LABELS[role]}
        </Badge>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {ROLE_DESCRIPTIONS[role]}
        </p>
      </div>
    </section>
  );
}
