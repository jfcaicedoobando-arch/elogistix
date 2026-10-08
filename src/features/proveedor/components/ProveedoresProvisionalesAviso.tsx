/** Aviso con los agentes provisionales pendientes de aprobación por Contabilidad. */
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { fetchProveedoresProvisionales } from "@/features/proveedor/services/altaProvisional";

export function ProveedoresProvisionalesAviso() {
  const { data = [] } = useQuery({
    queryKey: ["proveedores", "provisionales"],
    queryFn: fetchProveedoresProvisionales,
    staleTime: 60_000,
  });
  if (data.length === 0) return null;
  return (
    <div className="rounded-md border border-warning/40 bg-warning/10 p-3 text-body-sm">
      <div className="flex items-center gap-2 font-medium">
        <AlertTriangle className="h-4 w-4 text-warning" />
        Provisionales por aprobar ({data.length})
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {data.map((p) => (
          <Link key={p.id} to={`/proveedores/${p.id}`}>
            <Badge variant="outline" className="hover:bg-muted">{p.nombre}</Badge>
          </Link>
        ))}
      </div>
    </div>
  );
}
