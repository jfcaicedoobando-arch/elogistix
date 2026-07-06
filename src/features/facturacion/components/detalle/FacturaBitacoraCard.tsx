/**
 * FacturaBitacoraCard — historial de eventos de la factura filtrados por
 * `modulo='facturas'` y `entidad_id=facturaId`. Visible para todos los
 * usuarios con acceso al detalle.
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useBitacora } from "@/hooks/shared";
import { formatDate } from "@/lib/formatters";
import { History } from "lucide-react";

interface Props {
  facturaId: string;
}

export function FacturaBitacoraCard({ facturaId }: Props) {
  const { data, isLoading } = useBitacora({
    modulo: "facturas",
    limite: 25,
    pagina: 0,
  });

  const entradas = (data?.datos ?? []).filter((e) => e.entidad_id === facturaId);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <History className="h-4 w-4" />
          Historial de la factura
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : entradas.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Sin eventos registrados para esta factura.
          </p>
        ) : (
          <ul className="divide-y">
            {entradas.map((e) => (
              <li key={e.id} className="py-2 text-sm">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-medium capitalize">{e.accion}</span>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatDate(e.created_at)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {e.entidad_nombre} • {e.usuario_email}
                </p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
