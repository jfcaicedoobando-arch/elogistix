/**
 * Lista las cotizaciones vinculadas a una oportunidad (Sprint D).
 * 11.13.0: la query se mueve a `useOportunidadCotizaciones`.
 */
import { useNavigate } from "react-router-dom";
import { ClipboardList, Ship } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrencyCompact } from "@/lib/formatters";
import { useOportunidadCotizaciones } from "@/features/crm/hooks";
import { EmptyStateInline } from "@/components/empty/EmptyStateInline";

interface Props {
  oportunidadId: string;
}

export default function OportunidadCotizacionesList({ oportunidadId }: Props) {
  const navigate = useNavigate();
  const { data = [], isLoading } = useOportunidadCotizaciones(oportunidadId);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <ClipboardList className="h-4 w-4" /> Cotizaciones vinculadas ({data.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <EmptyStateInline loading message="Cargando…" />
        ) : data.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aún no se ha creado ninguna cotización para esta oportunidad. Usa el botón "Crear cotización" arriba.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-muted-foreground border-b">
                <th className="text-left py-1">Folio</th>
                <th className="text-left">Estado</th>
                <th className="text-right">Monto</th>
                <th className="text-center">Embarque</th>
              </tr>
            </thead>
            <tbody>
              {data.map((c) => {
                const diasEnviada =
                  c.estado === "Enviada"
                    ? Math.floor((Date.now() - new Date(c.created_at).getTime()) / 86_400_000)
                    : 0;
                return (
                  <tr
                    key={c.id}
                    className="border-b hover:bg-muted/50 cursor-pointer"
                    onClick={() => navigate(`/cotizaciones/${c.id}`)}
                  >
                    <td className="py-1 font-medium">{c.folio}</td>
                    <td>
                      <div className="flex items-center gap-1.5">
                        <Badge variant="outline">{c.estado}</Badge>
                        {c.estado === "Enviada" && diasEnviada > 5 && (
                          <Badge variant="destructive" className="text-2xs">
                            Sin respuesta · {diasEnviada}d
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="text-right">{formatCurrencyCompact(Number(c.subtotal ?? 0), c.moneda)}</td>
                    <td className="text-center">
                      {c.embarque_id ? (
                        <Button
                          variant="link"
                          size="sm"
                          className="h-auto p-0 inline-flex items-center gap-1"
                          onClick={(e) => { e.stopPropagation(); navigate(`/embarques/${c.embarque_id}`); }}
                        >
                          <Ship className="h-3 w-3" /> Ver
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}
