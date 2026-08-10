/**
 * Aviso dentro del modal "Capturar factura de proveedor" cuando el emisor del
 * documento no existe en el catálogo.
 *
 * El alta de proveedores se hace SIEMPRE desde el módulo de Proveedores para
 * evitar registros incompletos: aquí sólo se informa y se ofrece el atajo.
 */
import { UserPlus, ExternalLink } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

interface Props {
  /** RFC / Tax ID detectado en el documento (puede venir vacío). */
  rfc: string;
  /** Razón social detectada en el documento. */
  nombre: string;
}

export function ProveedorNoEncontradoAlert({ rfc, nombre }: Props) {
  const params = new URLSearchParams({ nuevo: "1" });
  if (rfc) params.set("rfc", rfc);
  if (nombre) params.set("nombre", nombre);
  const url = `/compras/proveedores?${params.toString()}`;

  return (
    <Alert variant="warning">
      <UserPlus className="h-4 w-4" />
      <AlertTitle>No encontramos a este proveedor en tu catálogo</AlertTitle>
      <AlertDescription className="space-y-2">
        <p className="text-sm">
          Detectamos <span className="font-medium">{nombre || "(sin nombre)"}</span>
          {rfc ? <> con RFC / Tax ID <span className="font-mono">{rfc}</span></> : null}.
          El alta de proveedores se hace desde el módulo de Proveedores.
        </p>
        <p className="text-xs text-muted-foreground">
          Se abrirá en una pestaña nueva con los datos prellenados; al terminar,
          regresa aquí y selecciona el proveedor en el buscador. No perderás la captura.
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.open(url, "_blank", "noopener,noreferrer")}
        >
          Dar de alta en Proveedores
          <ExternalLink className="h-3.5 w-3.5 ml-1.5" />
        </Button>
      </AlertDescription>
    </Alert>
  );
}
