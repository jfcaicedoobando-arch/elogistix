/**
 * Estado de éxito del modal de envío: muestra el enlace del portal copiable.
 */
import { CheckCircle2, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  estado: string;
  enlacePortal: string;
  onCopiar: (link: string) => void;
}

export function EnvioProformaExitoso({ estado, enlacePortal, onCopiar }: Props) {
  return (
    <div className="space-y-3 py-2">
      <div className="flex items-center gap-2 text-green-600">
        <CheckCircle2 className="h-5 w-5" />
        <span className="font-semibold">Correo {estado}</span>
      </div>
      <div>
        <Label className="text-xs uppercase text-muted-foreground">Enlace del portal</Label>
        <div className="flex gap-2 mt-1">
          <Input readOnly value={enlacePortal} className="text-xs" />
          <Button variant="outline" size="icon" onClick={() => onCopiar(enlacePortal)} aria-label="Copiar enlace">
            <Copy className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Puedes compartir este enlace por WhatsApp u otro canal si el cliente no recibe el correo.
        </p>
      </div>
    </div>
  );
}
