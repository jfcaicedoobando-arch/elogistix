/** Aviso con los agentes provisionales pendientes de aprobación por Contabilidad. */
import { Link } from "react-router";
import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useProveedoresProvisionales } from "@/features/proveedor/hooks/useProveedoresProvisionales";

export function ProveedoresProvisionalesAviso() {
  const { data = [] } = useProveedoresProvisionales();
  if (data.length === 0) return null;
  return (
    <Alert variant="warning">
      <AlertTriangle className="size-4" />
      <AlertTitle>
        Provisionales por aprobar ({data.length})
      </AlertTitle>
      <AlertDescription className="mt-2 flex flex-wrap gap-2">
        {data.map((p) => (
          <Link key={p.id} to={`/proveedores/${p.id}`}>
            <Badge variant="outline" className="hover:bg-muted">{p.nombre}</Badge>
          </Link>
        ))}
      </AlertDescription>
    </Alert>
  );
}
