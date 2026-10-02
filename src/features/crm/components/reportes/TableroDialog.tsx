/**
 * Diálogo pequeño para crear o renombrar un tablero de reportes.
 */
import { useEffect, useState } from "react";
import { LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormDialogShell } from "@/components/shared/FormDialogShell";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Si viene, el diálogo renombra; si no, crea. */
  tablero?: { id: string; nombre: string } | null;
  guardando: boolean;
  onGuardar: (nombre: string) => void;
}

export function TableroDialog({ open, onOpenChange, tablero, guardando, onGuardar }: Props) {
  const [nombre, setNombre] = useState("");

  useEffect(() => {
    if (open) setNombre(tablero?.nombre ?? "");
  }, [open, tablero]);

  const guardar = () => {
    if (nombre.trim() === "") return;
    onGuardar(nombre.trim());
  };

  return (
    <FormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={LayoutDashboard}
      title={tablero ? "Renombrar tablero" : "Nuevo tablero"}
      description="Un tablero agrupa varios reportes en una sola página."
      size="sm"
      footer={
        <Button onClick={guardar} disabled={guardando || nombre.trim() === ""}>
          {guardando ? "Guardando…" : "Guardar"}
        </Button>
      }
    >
      <div className="space-y-2">
        <Label htmlFor="tablero-nombre">Nombre del tablero</Label>
        <Input
          id="tablero-nombre"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Ej. Ventas del mes"
          maxLength={80}
        />
      </div>
    </FormDialogShell>
  );
}
