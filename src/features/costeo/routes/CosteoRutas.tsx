/**
 * Página: Rutas de costeo (par puerto origen CN → destino MX).
 * v13.67.5: enriquecida con conteo de tarifas vigentes, estado dinámico,
 *  filtro por estado y acceso directo a tarifas filtradas.
 */
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Plus, Trash2, ExternalLink, AlertTriangle } from "lucide-react";
import { useCosteoRutas, useCosteoRutaMutations } from "@/features/costeo/hooks/useCosteoRutas";
import { PageHeader } from "@/components/shared/PageHeader";
import { ConfirmDeleteAlert } from "@/features/costeo/components/ConfirmDeleteAlert";
import { RutaFormDialog } from "@/features/costeo/components/RutaFormDialog";
import {
  computeRutaEstado,
  diasParaExpirar,
  DIAS_POR_VENCER,
  type RutaEstadoMeta,
} from "@/features/costeo/utils/rutaEstado";

type FiltroEstado = "todas" | RutaEstadoMeta["key"];

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

export default function CosteoRutas() {
  const navigate = useNavigate();
  const { data: rutas = [], isLoading } = useCosteoRutas();
  const { crear, eliminar } = useCosteoRutaMutations();
  const [open, setOpen] = useState(false);
  const [aEliminar, setAEliminar] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<FiltroEstado>("todas");

  const rutasOrdenadas = useMemo(() => {
    const conMeta = rutas.map((r) => ({ ruta: r, meta: computeRutaEstado(r) }));
    const filtradas = filtro === "todas" ? conMeta : conMeta.filter((x) => x.meta.key === filtro);
    return filtradas.sort((a, b) => {
      if (a.meta.sortOrder !== b.meta.sortOrder) return a.meta.sortOrder - b.meta.sortOrder;
      return (a.ruta.puerto_origen_nombre ?? "").localeCompare(b.ruta.puerto_origen_nombre ?? "");
    });
  }, [rutas, filtro]);

  const conteos = useMemo(() => {
    const acc = { activa: 0, sin_tarifa: 0, por_vencer: 0, inactiva: 0 };
    rutas.forEach((r) => {
      const k = computeRutaEstado(r).key;
      acc[k] += 1;
    });
    return acc;
  }, [rutas]);

  return (
    <TooltipProvider delayDuration={150}>
      <div className="p-6 space-y-4">
        <PageHeader
          title="Rutas marítimas"
          description="Pares puerto China → puerto México disponibles para tarificar."
          actions={<Button onClick={() => setOpen(true)}><Plus className="size-4 mr-2" />Nueva ruta</Button>}
        />

        <Card className="p-4 flex flex-wrap items-end gap-3">
          <div className="min-w-[200px]">
            <Label htmlFor="filtro-ruta-estado" className="sr-only">Estado</Label>
            <Select value={filtro} onValueChange={(v) => setFiltro(v as FiltroEstado)}>
              <SelectTrigger id="filtro-ruta-estado" aria-label="Filtrar por estado">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas ({rutas.length})</SelectItem>
                <SelectItem value="sin_tarifa">Sin tarifa ({conteos.sin_tarifa})</SelectItem>
                <SelectItem value="por_vencer">Por vencer ({conteos.por_vencer})</SelectItem>
                <SelectItem value="activa">Activas ({conteos.activa})</SelectItem>
                <SelectItem value="inactiva">Inactivas ({conteos.inactiva})</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {conteos.sin_tarifa > 0 && (
            <p className="text-sm text-muted-foreground">
              <AlertTriangle className="inline size-3.5 mr-1 text-destructive" />
              {conteos.sin_tarifa} ruta{conteos.sin_tarifa === 1 ? "" : "s"} sin tarifa vigente.
            </p>
          )}
        </Card>

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
                  <TableCell colSpan={8} className="text-center text-muted-foreground">
                    Cargando…
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && rutasOrdenadas.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">
                    {rutas.length === 0 ? "Sin rutas registradas." : "Sin rutas para el filtro seleccionado."}
                  </TableCell>
                </TableRow>
              )}
              {rutasOrdenadas.map(({ ruta, meta }) => {
                const count = ruta.tarifas_vigentes_count ?? 0;
                const dias = diasParaExpirar(ruta);
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
                              onClick={() => setAEliminar(ruta.id)}
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

        <RutaFormDialog open={open} onOpenChange={setOpen} crear={crear} rutas={rutas} />

        <ConfirmDeleteAlert
          open={!!aEliminar}
          onOpenChange={(o) => !o && setAEliminar(null)}
          title="¿Eliminar esta ruta?"
          description="Esta acción no se puede deshacer."
          pending={eliminar.isPending}
          onConfirm={() => {
            if (aEliminar) {
              eliminar.mutate(aEliminar, { onSuccess: () => setAEliminar(null) });
            }
          }}
        />
      </div>
    </TooltipProvider>
  );
}
