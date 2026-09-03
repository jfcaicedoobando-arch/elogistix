/**
 * VendedorSelect — selector de usuario para asignar como vendedor/owner.
 *
 * Sólo se muestra a los roles que pueden gestionar CUALQUIER registro CRM
 * (`canReasignarVendedorCrm`). Un vendedor conserva su asignación actual, pero
 * no ve un selector que la RLS le rechazaría al guardar.
 */
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useUsuarios } from "@/features/admin/hooks/usuario";
import { usePermissions } from "@/hooks/shared";

interface Props {
  value: string | null;
  email?: string;
  onChange: (userId: string | null, email: string) => void;
  label?: string;
}

export default function VendedorSelect({ value, onChange, label = "Vendedor asignado" }: Props) {
  const { canReasignarVendedorCrm } = usePermissions();
  const { data: users = [] } = useUsuarios();

  if (!canReasignarVendedorCrm) return null;

  // Mostrar todos los usuarios staff + vendedores (no clientes ni viewers para CRM).
  const candidatos = users.filter((u) => ["admin", "operador", "vendedor", "gerente_comercial", "super_admin"].includes(u.role));

  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Select
        value={value ?? "ninguno"}
        onValueChange={(v) => {
          if (v === "ninguno") return onChange(null, "");
          const u = candidatos.find((x) => x.user_id === v);
          onChange(v, u?.email ?? "");
        }}
      >
        <SelectTrigger><SelectValue placeholder="Sin asignar…" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="ninguno">Sin asignar</SelectItem>
          {candidatos.map((u) => (
            <SelectItem key={u.user_id} value={u.user_id}>{u.email}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
