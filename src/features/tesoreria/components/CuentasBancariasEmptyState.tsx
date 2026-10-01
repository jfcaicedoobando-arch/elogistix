import { Landmark } from "lucide-react";
import { EmptyStateInline } from "@/components/empty/EmptyStateInline";

export function CuentasBancariasEmptyState({ puedeAdministrar, onAdministrar }: {
  puedeAdministrar: boolean; onAdministrar?: () => void;
}) {
  return <EmptyStateInline icon={Landmark} message="No hay cuentas bancarias activas."
    hint={puedeAdministrar
      ? "Registra o activa una cuenta bancaria para consultar movimientos y comenzar la conciliación."
      : "Solicita a un administrador o a Tesorería que registre o active una cuenta bancaria."}
    action={puedeAdministrar && onAdministrar ? { label: "Administrar cuentas", onClick: onAdministrar } : undefined} />;
}
