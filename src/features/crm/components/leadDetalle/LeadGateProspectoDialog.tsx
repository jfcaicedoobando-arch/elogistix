/**
 * Diálogo del gate Lead → Prospecto.
 *
 * v13.823.31 — Antes, si faltaban campos del perfil ICP, "Calificar como
 * prospecto" sólo emitía un toast (que podía quedar deduplicado y parecer que
 * "no pasaba nada"). Ahora el usuario recibe una lista accesible de faltantes y
 * un CTA que lo lleva al Perfil ICP.
 */
import { ClipboardList } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  faltantes: string[];
  /** Lleva el foco al Perfil ICP del lead. */
  onIrAlPerfil: () => void;
}

export default function LeadGateProspectoDialog({
  open, onOpenChange, faltantes, onIrAlPerfil,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-accent" />
            Falta completar el perfil comercial
          </DialogTitle>
          <DialogDescription>
            Para calificar el lead como prospecto captura estos campos del Perfil ICP:
          </DialogDescription>
        </DialogHeader>
        <ul className="list-disc pl-5 space-y-1 text-body-sm" aria-label="Campos faltantes del perfil ICP">
          {faltantes.map((campo) => (
            <li key={campo}>{campo}</li>
          ))}
        </ul>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cerrar</Button>
          <Button
            onClick={() => {
              onOpenChange(false);
              onIrAlPerfil();
            }}
          >
            Ir al Perfil ICP
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
