/**
 * Semáforo de "listo para facturar" del nuevo receptor: indica qué dato fiscal
 * falta y ofrece el enlace al expediente del cliente para corregirlo.
 */
import { AlertTriangle, CheckCircle2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  pendientesReceptorFiscal,
  type ReceptorFiscal,
} from "@/features/facturacion/domain/refacturacionValidaciones";

interface Props {
  clienteId: string | null;
  receptor: ReceptorFiscal | null;
}

export function ReceptorFiscalSemaforo({ clienteId, receptor }: Props) {
  if (!clienteId || !receptor) return null;
  const faltan = pendientesReceptorFiscal(receptor);

  if (faltan.length === 0) {
    return (
      <div className="rounded-md border border-success/30 bg-success/5 p-3 text-body flex items-start gap-2">
        <CheckCircle2 className="h-4 w-4 text-success mt-0.5" />
        <span>El receptor tiene RFC, régimen fiscal y código postal: listo para facturar.</span>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-warning/30 bg-warning/5 p-3 space-y-2">
      <div className="flex items-start gap-2 text-body">
        <AlertTriangle className="h-4 w-4 text-warning mt-0.5" />
        <span>
          Faltan datos fiscales del receptor: <strong>{faltan.join(", ")}</strong>. Corrígelos en
          el expediente del cliente antes de abrir el caso.
        </span>
      </div>
      <Button variant="outline" size="sm" asChild>
        <a href={`/clientes/${clienteId}`} target="_blank" rel="noreferrer">
          <ExternalLink className="h-4 w-4 mr-1" /> Abrir expediente del cliente
        </a>
      </Button>
    </div>
  );
}
