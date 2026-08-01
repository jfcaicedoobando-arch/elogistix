/**
 * P1-1 (R5): un listado vacío era indistinguible de "estoy viendo otra
 * organización". Este aviso muestra la organización activa en los estados
 * vacíos para que el usuario detecte de inmediato un contexto equivocado.
 */
import { Building2 } from "lucide-react";
import { useOrganization } from "@/lib/contexts/OrganizationContext";

export function OrgContextoHint({ className }: { className?: string }) {
  const { organization } = useOrganization();
  const nombre = organization?.nombre;
  if (!nombre) return null;
  return (
    <p className={`flex items-center justify-center gap-1.5 text-xs text-muted-foreground ${className ?? ""}`}>
      <Building2 className="h-3.5 w-3.5" aria-hidden="true" />
      Estás viendo la organización <span className="font-medium text-foreground">{nombre}</span>
    </p>
  );
}
