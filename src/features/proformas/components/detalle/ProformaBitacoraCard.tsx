/**
 * ProformaBitacoraCard — feed de auditoría de la proforma (bitácora de
 * actividad). Da trazabilidad de quién envió, aceptó, editó o facturó.
 */
import { useQuery } from "@tanstack/react-query";
import { History } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ListSkeleton } from "@/components/shared/states/ListSkeleton";
import { fetchBitacoraProforma } from "@/features/proformas/services/bitacoraProforma";
import { queryKeys } from "@/lib/query";
import { formatDate } from "@/lib/formatters";
import { describirEntrada } from "@/lib/domain/bitacoraDescripcion";

interface Props {
  proformaId: string;
}

export function ProformaBitacoraCard({ proformaId }: Props) {
  const { data, isLoading, isError } = useQuery({
    queryKey: queryKeys.proformas.bitacora(proformaId),
    queryFn: () => fetchBitacoraProforma(proformaId),
    enabled: Boolean(proformaId),
    staleTime: 30_000,
  });

  const entradas = data ?? [];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <History className="h-4 w-4 text-muted-foreground" />
          Actividad
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <ListSkeleton rows={3} />
        ) : isError ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No se pudo cargar la actividad de esta proforma.
          </p>
        ) : entradas.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Sin movimientos registrados.
          </p>
        ) : (
          <ul className="divide-y">
            {entradas.map((e) => {
              const descripcion = describirEntrada(e);
              return (
                <li key={e.id} className="py-2 text-sm">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-medium truncate">
                      {descripcion.titulo || e.accion}
                    </span>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDate(e.created_at)}
                    </span>
                  </div>
                  {descripcion.contexto && (
                    <p className="text-xs text-muted-foreground truncate">{descripcion.contexto}</p>
                  )}
                  {e.usuario_email && (
                    <p className="text-xs text-muted-foreground truncate">{e.usuario_email}</p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
