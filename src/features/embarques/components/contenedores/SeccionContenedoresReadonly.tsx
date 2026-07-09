/**
 * Vista solo-lectura de contenedores en el detalle del embarque.
 * Toda edición se realiza desde el wizard "Editar embarque" (paso 2).
 */
import { useNavigate } from "react-router-dom";
import { Loader2, Pencil } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getErrorMessage } from "@/lib/errors";
import { useContenedoresEmbarque } from "@/features/embarques/hooks";
import { formatNumber } from "@/lib/formatters";

interface Props {
  embarqueId: string;
}

export function SeccionContenedoresReadonly({ embarqueId }: Props) {
  const navigate = useNavigate();
  const { data: contenedores = [], isLoading, error } =
    useContenedoresEmbarque(embarqueId);

  const irAEditar = () => navigate(`/embarques/${embarqueId}/editar?step=2`);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3">
        <div>
          <CardTitle className="text-sm">
            Contenedores ({contenedores.length})
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Para agregar, editar o eliminar contenedores usa el botón
            <span className="font-medium"> Editar embarque</span>.
          </p>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={irAEditar}>
          <Pencil className="h-4 w-4 mr-1" />
          Editar contenedores
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Cargando contenedores…
          </div>
        ) : error ? (
          <p className="text-sm text-destructive">
            Error al cargar: {getErrorMessage(error)}
          </p>
        ) : contenedores.length === 0 ? (
          <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Aún no hay contenedores capturados para este embarque.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b">
                  <th className="text-left font-medium py-2 px-2">#</th>
                  <th className="text-left font-medium py-2 px-2">Número</th>
                  <th className="text-left font-medium py-2 px-2">Tipo</th>
                  <th className="text-left font-medium py-2 px-2">BL House</th>
                  <th className="text-right font-medium py-2 px-2">Peso (kg)</th>
                  <th className="text-right font-medium py-2 px-2">Volumen (m³)</th>
                  <th className="text-right font-medium py-2 px-2">Piezas</th>
                </tr>
              </thead>
              <tbody>
                {contenedores.map((c, i) => (
                  <tr key={c.id} className="border-b last:border-0 odd:bg-muted/20">
                    <td className="py-2 px-2 text-muted-foreground">{i + 1}</td>
                    <td className="py-2 px-2 font-medium">
                      {c.numero_contenedor || <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="py-2 px-2">
                      {c.tipo_contenedor
                        ? <Badge variant="secondary">{c.tipo_contenedor}</Badge>
                        : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="py-2 px-2">{c.bl_house || <span className="text-muted-foreground">—</span>}</td>
                    <td className="py-2 px-2 text-right tabular-nums">{formatNumber(Number(c.peso_kg))}</td>
                    <td className="py-2 px-2 text-right tabular-nums">{formatNumber(Number(c.volumen_m3))}</td>
                    <td className="py-2 px-2 text-right tabular-nums">{c.piezas}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
