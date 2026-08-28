/**
 * Acciones de avance de etapa del lead (tomar, calificar, nueva oportunidad).
 * Extraído de `LeadHeaderActions` para mantener la complejidad por función
 * dentro del límite del proyecto.
 */
import { BadgeCheck, Briefcase, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  mostrarTomar?: boolean;
  onTomar?: () => void;
  tomando?: boolean;
  mostrarCalificar?: boolean;
  onCalificar?: () => void;
  calificando?: boolean;
  mostrarNuevaOportunidad?: boolean;
  onNuevaOportunidad?: () => void;
}

export default function LeadAccionesEtapa({
  mostrarTomar = false,
  onTomar,
  tomando = false,
  mostrarCalificar = false,
  onCalificar,
  calificando = false,
  mostrarNuevaOportunidad = false,
  onNuevaOportunidad,
}: Props) {
  return (
    <>
      {mostrarTomar && onTomar ? (
        <Button variant="default" onClick={onTomar} disabled={tomando}>
          <UserCheck className="h-4 w-4 mr-1" />
          {tomando ? "Tomando…" : "Tomar lead"}
        </Button>
      ) : null}
      {mostrarCalificar && onCalificar ? (
        <Button variant="default" onClick={onCalificar} disabled={calificando}>
          <BadgeCheck className="h-4 w-4 mr-1" />
          {calificando ? "Calificando…" : "Calificar como prospecto"}
        </Button>
      ) : null}
      {mostrarNuevaOportunidad && onNuevaOportunidad ? (
        <Button variant="default" onClick={onNuevaOportunidad}>
          <Briefcase className="h-4 w-4 mr-1" /> Nueva oportunidad
        </Button>
      ) : null}
    </>
  );
}
