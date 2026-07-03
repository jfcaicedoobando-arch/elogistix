/**
 * Página: Rutas de costeo (par puerto origen CN → destino MX).
 * v13.68.1: dividida en sub-componentes para cumplir Power of 10 (≤200 líneas).
 * Oleada 4: migrado a PageContainer + ListSkeleton compartidos.
 */
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AlertTriangle, Plus } from "lucide-react";
import { useCosteoRutas, useCosteoRutaMutations } from "@/features/costeo/hooks/useCosteoRutas";
import { PageContainer } from "@/components/shared/PageContainer";
import { PageHeader } from "@/components/shared/PageHeader";
import { ConfirmDeleteAlert } from "@/features/costeo/components/ConfirmDeleteAlert";
import { RutaFormDialog } from "@/features/costeo/components/RutaFormDialog";
import { CosteoRutasTable } from "@/features/costeo/components/CosteoRutasTable";
import { computeRutaEstado, type RutaEstadoMeta } from "@/features/costeo/utils/rutaEstado";

type FiltroEstado = "todas" | RutaEstadoMeta["key"];

export default function CosteoRutas() {
  const { data: rutas = [], isLoading } = useCosteoRutas();
  const { crear, eliminar } = useCosteoRutaMutations();
  const [open, setOpen] = useState(false);
  const [aEliminar, setAEliminar] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<FiltroEstado>("todas");

  const rutasOrdenadas = useMemo(() => {
    const conMeta = rutas.map((r) => ({ ruta: r, meta: computeRutaEstado(r) }));
    const filtradas =
      filtro === "todas" ? conMeta : conMeta.filter((x) => x.meta.key === filtro);
    return filtradas.sort((a, b) => {
      if (a.meta.sortOrder !== b.meta.sortOrder)
        return a.meta.sortOrder - b.meta.sortOrder;
      return (a.ruta.puerto_origen_nombre ?? "").localeCompare(
        b.ruta.puerto_origen_nombre ?? "",
      );
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
      <PageContainer>
        <PageHeader
          title="Rutas marítimas"
          description="Pares puerto China → puerto México disponibles para tarificar."
          actions={
            <Button onClick={() => setOpen(true)}>
              <Plus className="size-4 mr-2" />Nueva ruta
            </Button>
          }
        />

        <Card className="p-4 flex flex-wrap items-end gap-3">
          <div className="min-w-[200px]">
            <Label htmlFor="filtro-ruta-estado" className="sr-only">
              Estado
            </Label>
            <Select
              value={filtro}
              onValueChange={(v) => setFiltro(v as FiltroEstado)}
            >
              <SelectTrigger id="filtro-ruta-estado" aria-label="Filtrar por estado">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas ({rutas.length})</SelectItem>
                <SelectItem value="sin_tarifa">
                  Sin tarifa ({conteos.sin_tarifa})
                </SelectItem>
                <SelectItem value="por_vencer">
                  Por vencer ({conteos.por_vencer})
                </SelectItem>
                <SelectItem value="activa">Activas ({conteos.activa})</SelectItem>
                <SelectItem value="inactiva">
                  Inactivas ({conteos.inactiva})
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          {conteos.sin_tarifa > 0 && (
            <p className="text-sm text-muted-foreground">
              <AlertTriangle className="inline size-3.5 mr-1 text-destructive" />
              {conteos.sin_tarifa} ruta{conteos.sin_tarifa === 1 ? "" : "s"} sin
              tarifa vigente.
            </p>
          )}
        </Card>

        <CosteoRutasTable
          rutasOrdenadas={rutasOrdenadas}
          isLoading={isLoading}
          totalRutas={rutas.length}
          onEliminar={(id) => setAEliminar(id)}
        />

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
      </PageContainer>
    </TooltipProvider>
  );
}
