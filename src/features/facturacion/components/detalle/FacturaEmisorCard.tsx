/**
 * FacturaEmisorCard — muestra los datos del emisor (razón social, RFC,
 * dirección, contacto) que van a aparecer en el CFDI. Lectura desde la
 * configuración de la organización via `fetchEmisorEmpresa`.
 */
import { useQuery } from "@tanstack/react-query";
import { Building2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FieldGridSkeleton } from "@/components/shared/skeletons";
import { fetchEmisorEmpresa } from "@/features/configuracion/services";

export function FacturaEmisorCard() {
  const { data: emisor, isLoading } = useQuery({
    queryKey: ["emisor-empresa"],
    queryFn: fetchEmisorEmpresa,
    staleTime: 5 * 60 * 1000,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Building2 className="h-4 w-4" /> Emisor
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1 text-sm">
        {isLoading || !emisor ? (
          <FieldGridSkeleton fields={4} cols={2} />
        ) : (
          <>
            <p className="font-semibold">{emisor.razonSocial}</p>
            {emisor.rfc && (
              <p className="text-muted-foreground">
                RFC: <span className="font-mono">{emisor.rfc}</span>
              </p>
            )}
            {emisor.direccion && <p className="text-muted-foreground">{emisor.direccion}</p>}
            {emisor.contacto && <p className="text-muted-foreground">{emisor.contacto}</p>}
          </>
        )}
      </CardContent>
    </Card>
  );
}
