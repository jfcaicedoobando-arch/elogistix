import { ArrowRightLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  cantidad: number; cargando: boolean; error: boolean;
  puedeAdministrar: boolean; onAbrir: () => void;
}
export function TraspasoCuentasAction({ cantidad, cargando, error, onAbrir }: Props) {
  const disponible = !cargando && !error && cantidad >= 2;
  return <Button variant="outline" disabled={!disponible}
    aria-describedby={!disponible && !cargando && !error ? "traspaso-requisito" : undefined}
    onClick={() => { if (disponible) onAbrir(); }}>
    <ArrowRightLeft className="h-4 w-4 mr-2" /> Traspaso entre cuentas
  </Button>;
}

export function AvisoTraspasoRequisitos({ cantidad, cargando, error, puedeAdministrar }: Props) {
  if (cargando || error || cantidad >= 2) return null;
  return <p id="traspaso-requisito" className="text-body-sm text-muted-foreground">
    Para un traspaso necesitas al menos dos cuentas bancarias activas.
    {!puedeAdministrar && " Solicita su registro o activación a un administrador o a Tesorería."}
  </p>;
}
