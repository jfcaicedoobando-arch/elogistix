/**
 * v13.503.0 — Nota para contabilidad, colapsada por defecto: casi nunca se usa
 * y ocupaba un bloque completo del modal del buzón.
 */
import { useState } from "react";
import { MessageSquarePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  nota: string;
  onNota: (valor: string) => void;
}

export function NotaContabilidadCampo({ nota, onNota }: Props) {
  const [abierto, setAbierto] = useState(false);

  if (!abierto && !nota) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 px-2 text-body-sm"
        onClick={() => setAbierto(true)}
      >
        <MessageSquarePlus className="mr-2 h-3.5 w-3.5" />
        Agregar nota para contabilidad
      </Button>
    );
  }

  return (
    <Textarea
      id="factura-entrante-nota"
      aria-label="Nota para contabilidad"
      value={nota}
      onChange={(e) => onNota(e.target.value)}
      placeholder="Ej. Factura del agente en Shanghái, incluye THC destino."
      rows={3}
    />
  );
}
