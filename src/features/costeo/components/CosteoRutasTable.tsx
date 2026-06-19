/**
 * Tabla de rutas marítimas (cuerpo de CosteoRutas).
 * Extraído para cumplir Power of 10 (≤200 líneas).
 */
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from "@/components/ui/tooltip";
import { AlertTriangle, ExternalLink, Trash2 } from "lucide-react";
import {
  computeRutaEstado, diasParaExpirar, DIAS_POR_VENCER, type RutaEstadoMeta,
} from "@/features/costeo/utils/rutaEstado";

const TONE_VARIANT: Record<RutaEstadoMeta["tone"], "default" | "destructive" | "secondary" | "outline"> = {
  success: "default",
  warning: "outline",
  destructive: "destructive",
  muted: "secondary",
};

function formatFecha(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric" });
}

interface RutaRow {
  id: string;
  puerto_origen_nombre?: string | null;
  puerto_destino_nombre?: string | null;
  tarifas_vigentes_count?: number | null;
  proveedores_count?: number | null;
  proxima_expiracion?: string | null;
  ultima_actualizacion_tarifa?: string | null;
}

interface Props {
  rutasOrdenadas: Array<{ ruta: RutaRow; meta: RutaEstadoMeta }>;
  isLoading: boolean;
  totalRutas: number;
  onEliminar: (id: string) => void;
}

export function CosteoRutasTable({ rutasOrdenadas, isLoading, totalRutas, onEliminar }: Props) {
  const navigate = useNavigate();
  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Origen (CN)</TableHead>
            <TableHead>Destino (MX)</TableHead>
            <TableHead className="text-center">Tarifas vigentes</TableHead>
            <TableHead className="text-center">Proveedores</TableHead>
            <TableHead>Próxima a vencer</TableHead>
            <TableHead>Última actualización</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="w-32 text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading && (
            <TableRow>
              <TableCell colSpan={8} className="text-center text-muted-foreground">Cargando…</TableCell>
            </TableRow>
          )}
          {!isLoading && rutasOrdenadas.length === 0 && (
            <TableRow>
              <TableCell colSpan={8} className="text-center text-muted-foreground">
                {totalRutas === 0 ? "Sin rutas registradas." : "Sin rutas para el filtro seleccionado."}
              </TableCell>
            </TableRow>
          )}
          {rutasOrdenadas.map(({ ruta, meta }) => {
            const count = ruta.tarifas_vigentes_count ?? 0;
            const dias = diasParaExpirar(ruta as Parameters<typeof computeRutaEstado>[0]);
            const porVencer = dias !== null && dias <= DIAS_POR_VENCER;
            return (
              <TableRow key={ruta.id}>
                <TableCell className="font-medium">{ruta.puerto_origen_nombre ?? "—"}</TableCell>
                <TableCell>{ruta.puerto_destino_nombre ?? "—"}</TableCell>
                <TableCell className="text-center">
                  {count === 0 ? (
                    <Badge variant="destructive">Sin tarifa</Badge>
                  ) : (
                    <Badge variant={count >= 3 ? "default" : "outline"}>{count}</Badge>
                  )}
                </TableCell>
                <TableCell className="text-center text-sm text-muted-foreground tabular-nums">
                  {ruta.proveedores_count ?? 0}
                </TableCell>
                <TableCell className="text-sm">
                  {ruta.proxima_expiracion ? (
                    <span className={porVencer ? "text-destructive font-medium" : "text-muted-foreground"}>
                      {porVencer && <AlertTriangle className="inline size-3.5 mr-1" />}
                      {formatFecha(ruta.proxima_expiracion)}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatFecha(ruta.ultima_actualizacion_tarifa)}
                </TableCell>
                <TableCell>
                  <Badge variant={TONE_VARIANT[meta.tone]}>{meta.label}</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1 justify-end">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => navigate(`/costeo/tarifas?ruta=${ruta.id}`)}
                          aria-label="Ver tarifas de esta ruta"
                        >
                          <ExternalLink className="size-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Ver tarifas</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => onEliminar(ruta.id)}
                          aria-label="Eliminar ruta"
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Eliminar ruta</TooltipContent>
                    </Tooltip>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Card>
  );
}
