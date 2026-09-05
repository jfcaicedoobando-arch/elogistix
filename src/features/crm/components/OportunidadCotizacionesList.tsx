/**
 * Lista las cotizaciones vinculadas a una oportunidad (Sprint D).
 * 11.13.0: la query se mueve a `useOportunidadCotizaciones`.
 */
import { useNavigate } from "react-router-dom";
import { ClipboardList, Ship } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrencyCompact } from "@/lib/formatters";
import { useOportunidadCotizaciones } from "@/features/crm/hooks";
import { EmptyStateInline } from "@/components/empty/EmptyStateInline";
import { diffDiasMx } from "@/lib/date/mx";

import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { DetailTableHead } from "@/components/shared/DetailTable";
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
          <EmptyStateInline
            icon={ClipboardList}
            message="Aún no se ha creado ninguna cotización para esta oportunidad."
            hint='Usa el botón "Nueva cotización" arriba.'
          />
        ) : (
          <div className="overflow-x-auto">
          <Table className="w-full text-body">
            <TableHeader>
              <TableRow className="text-body-sm text-muted-foreground border-b">
                <DetailTableHead>Folio</DetailTableHead>
                <DetailTableHead>Estado</DetailTableHead>
                <DetailTableHead className="text-right">Monto</DetailTableHead>
                <DetailTableHead className="text-center">Embarque</DetailTableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((c) => {
                const diasEnviada =
                  c.estado === "Enviada"
                    ? (diffDiasMx(c.created_at, new Date()) ?? 0)
                    : 0;
                return (
                  <TableRow
                    key={c.id}
                    className="border-b hover:bg-muted/50 cursor-pointer"
                    onClick={() => navigate(`/cotizaciones/${c.id}`)}
                    role="link"
                    tabIndex={0}
                    aria-label={`Abrir cotización ${c.folio}`}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        navigate(`/cotizaciones/${c.id}`);
                      }
                    }}
                  >
                    <TableCell className="font-medium">{c.folio}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <Badge variant="outline">{c.estado}</Badge>
                        {c.estado === "Enviada" && diasEnviada > 5 && (
                          <Badge variant="destructive" className="text-label">
                            Sin respuesta · {diasEnviada}d
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{formatCurrencyCompact(Number(c.subtotal ?? 0), c.moneda)}</TableCell>
                    <TableCell className="text-center">
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
                        <span className="text-body-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
