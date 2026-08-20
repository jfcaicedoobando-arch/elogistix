/**
 * Vista solo-lectura de contenedores en el detalle del embarque.
 * Toda edición se realiza desde el wizard "Editar embarque" (paso 2).
 */
import { useNavigate } from "react-router-dom";
import { Pencil } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getErrorMessage } from "@/lib/errors";
import { useContenedoresEmbarque } from "@/features/embarques/hooks";
import { useTiposContenedor } from "@/features/catalogos/hooks";
import { resolveTipoContenedorNombre } from "@/features/cotizacion/utils/resolveTipoContenedorNombre";
import { formatNumber } from "@/lib/formatters";
import { EmptyStateInline } from "@/components/empty/EmptyStateInline";
import { PackageOpen } from "lucide-react";

import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { DetailTableHead } from "@/components/shared/DetailTable";
interface Props {
  embarqueId: string;
}

interface Contenedor {
  id: string;
  numero_contenedor?: string | null;
  tipo_contenedor?: string | null;
  bl_house?: string | null;
  peso_kg?: number | string | null;
  volumen_m3?: number | string | null;
  piezas?: number | null;
}

function todosIguales<T>(arr: T[]): boolean {
  if (arr.length <= 1) return false;
  const first = String(arr[0]);
  return arr.every((v) => String(v) === first);
}

export function SeccionContenedoresReadonly({ embarqueId }: Props) {
  const navigate = useNavigate();
  const { data: contenedores = [], isLoading, error } =
    useContenedoresEmbarque(embarqueId);
  const { data: tiposContenedor = [] } = useTiposContenedor();

  const irAEditar = () => navigate(`/embarques/${embarqueId}/editar?step=2`);

  const lista = contenedores as Contenedor[];
  const mostrarBLHouse = lista.some((c) => (c.bl_house ?? "").trim().length > 0);
  const pesos = lista.map((c) => Number(c.peso_kg) || 0);
  const volumenes = lista.map((c) => Number(c.volumen_m3) || 0);
  const piezas = lista.map((c) => c.piezas ?? 0);
  const pesoUniforme = todosIguales(pesos);
  const volumenUniforme = todosIguales(volumenes);
  const piezasUniformes = todosIguales(piezas);
  const hayResumenUniforme = pesoUniforme || volumenUniforme || piezasUniformes;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3">
        <div>
          <CardTitle>
            Contenedores ({lista.length})
          </CardTitle>
          <p className="text-body-sm text-muted-foreground mt-1">
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
          <div className="flex items-center justify-center py-6 text-body text-muted-foreground">
            <EmptyStateInline loading message="Cargando contenedores…" />
          </div>
        ) : error ? (
          <p className="text-body text-destructive">
            Error al cargar: {getErrorMessage(error)}
          </p>
        ) : lista.length === 0 ? (
          <div className="rounded-md border border-dashed border-border">
            <EmptyStateInline
              icon={PackageOpen}
              message="Aún no hay contenedores capturados para este embarque."
              className="py-6"
            />
          </div>
        ) : (
          <div className="space-y-3">
            {hayResumenUniforme && (
              <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-body-sm">
                <span className="font-medium text-muted-foreground">Todos los contenedores:</span>
                {pesoUniforme && (
                  <Badge variant="outline" className="font-normal">
                    {formatNumber(pesos[0])} kg
                  </Badge>
                )}
                {volumenUniforme && (
                  <Badge variant="outline" className="font-normal">
                    {formatNumber(volumenes[0], { decimals: 2 })} m³
                  </Badge>
                )}
                {piezasUniformes && (
                  <Badge variant="outline" className="font-normal">
                    {formatNumber(piezas[0])} piezas
                  </Badge>
                )}
              </div>
            )}
            <div className="overflow-x-auto">
              <Table className="w-full max-w-3xl text-body">
                <TableHeader className="text-body-sm text-muted-foreground">
                  <TableRow className="border-b">
                    <DetailTableHead className="w-auto">Número</DetailTableHead>
                    <DetailTableHead className="w-[140px]">Tipo</DetailTableHead>
                    {mostrarBLHouse && <DetailTableHead className="w-[180px]">BL House</DetailTableHead>}
                    {!pesoUniforme && <DetailTableHead className="text-right w-[120px]">Peso (kg)</DetailTableHead>}
                    {!volumenUniforme && <DetailTableHead className="text-right w-[120px]">Volumen (m³)</DetailTableHead>}
                    {!piezasUniformes && <DetailTableHead className="text-right w-[100px]">Piezas</DetailTableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lista.map((c) => (
                    <TableRow key={c.id} className="border-b last:border-0 odd:bg-muted/20">
                      <TableCell className="font-medium">
                        {c.numero_contenedor || <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell>
                        {c.tipo_contenedor
                          ? <Badge variant="secondary">{resolveTipoContenedorNombre(c.tipo_contenedor, tiposContenedor)}</Badge>
                          : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      {mostrarBLHouse && (
                        <TableCell>{c.bl_house || <span className="text-muted-foreground">—</span>}</TableCell>
                      )}
                      {!pesoUniforme && (
                        <TableCell className="text-right tabular-nums">{formatNumber(Number(c.peso_kg))}</TableCell>
                      )}
                      {!volumenUniforme && (
                        <TableCell className="text-right tabular-nums">{formatNumber(Number(c.volumen_m3))}</TableCell>
                      )}
                      {!piezasUniformes && (
                        <TableCell className="text-right tabular-nums">{c.piezas}</TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
