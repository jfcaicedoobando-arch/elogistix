/**
 * Aviso visible en la pestaña de Facturación del embarque cuando existen
 * proformas rechazadas por el cliente. La rechazo libera automáticamente
 * los conceptos (vía RPC), por lo que aquí sólo comunicamos el estado y
 * damos un atajo a la proforma rechazada para consultar el motivo.
 */
import { Link } from "react-router-dom";
import { AlertTriangle, ExternalLink } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/formatters";
import type { ProformaConFactura } from "@/features/proformas/services";

interface Props {
  proformas: ProformaConFactura[];
}

export function AvisoProformasRechazadas({ proformas }: Props) {
  const rechazadas = proformas.filter(
    (p) => (p.estado_cliente ?? "pendiente") === "rechazada",
  );
  if (rechazadas.length === 0) return null;

  return (
    <Alert variant="destructive" className="border-destructive/40">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>
        {rechazadas.length === 1
          ? "El cliente rechazó una proforma"
          : `El cliente rechazó ${rechazadas.length} proformas`}
      </AlertTitle>
      <AlertDescription className="space-y-2">
        <p className="text-sm">
          Los conceptos asociados se liberaron automáticamente. Puedes generar
          una nueva proforma para los conceptos pendientes.
        </p>
        <ul className="space-y-1.5">
          {rechazadas.map((p) => (
            <li
              key={p.id}
              className="flex flex-wrap items-center gap-2 text-sm"
            >
              <span className="font-mono font-medium">{p.numero}</span>
              {p.rechazada_at && (
                <span className="text-xs text-muted-foreground">
                  · {formatDate(p.rechazada_at)}
                </span>
              )}
              {p.motivo_rechazo && (
                <span
                  className="text-xs italic text-muted-foreground truncate max-w-md"
                  title={p.motivo_rechazo}
                >
                  «{p.motivo_rechazo}»
                </span>
              )}
              <Button
                asChild
                variant="ghost"
                size="sm"
                className="h-6 px-2 ml-auto"
              >
                <Link to={`/proformas/${p.id}`}>
                  <ExternalLink className="h-3 w-3 mr-1" />
                  Ver
                </Link>
              </Button>
            </li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  );
}
