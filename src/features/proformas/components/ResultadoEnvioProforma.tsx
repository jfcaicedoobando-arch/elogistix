import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { EnviarProformaEmailResult } from "@/features/proformas/services/enviarEmail";

interface Props {
  resultado: EnviarProformaEmailResult;
  onCopiar: (link: string) => void;
}

const resumen = {
  enviado: "Correo enviado",
  parcial: "Envío parcial",
  fallido: "Ninguna entrega confirmada",
  pendiente: "Hay entregas por confirmar. Reintenta para comprobar el mismo envío.",
};

const estadoDestinatario = {
  enviado: "Enviado",
  suprimido: "Suprimido por el servicio de correo",
  pendiente: "Pendiente de confirmar",
  sin_confirmar: "Sin confirmación. El enlace ya no está vigente.",
};

export function ResultadoEnvioProforma({ resultado, onCopiar }: Props) {
  const enlace = resultado.enlace_portal;
  return (
    <div className="space-y-3 py-2">
      <p role="status" className="font-semibold">{resumen[resultado.estado]}</p>
      {resultado.resultados.length > 0 && (
        <ul className="space-y-1 text-body-sm">
          {resultado.resultados.map(({ email, tipo, estado }) => (
            <li key={email}>{tipo === "cc" ? "CC " : ""}{email} · {estadoDestinatario[estado]}</li>
          ))}
        </ul>
      )}
      {enlace && (
        <div>
          <Label size="sm" className="uppercase text-muted-foreground" htmlFor="proforma-enlace-portal">
            Enlace del portal
          </Label>
          <div className="flex gap-2 mt-1">
            <Input id="proforma-enlace-portal" readOnly value={enlace} className="text-body-sm" />
            <Button variant="outline" size="icon" onClick={() => onCopiar(enlace)} aria-label="Copiar enlace">
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
