/**
 * CotizacionPlantillas — Gestión de plantillas de cotización (P2 cierre v13.296.0).
 * Refactor v13.297.4: tabla y dialog extraídos a `components/plantillas/*`.
 */
"use memo";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { notifySuccess } from "@/lib/ui/appFeedback";
import { notifyError } from "@/lib/ui/appFeedback";
import { Sparkles } from "lucide-react";
import { PageContainer } from "@/components/shared/PageContainer";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DeleteConfirmDialog } from "@/components/shared/dialogs/DeleteConfirmDialog";
import { useAuth } from "@/lib/contexts/AuthContext";
import {
  useCotizacionPlantillas,
  useEliminarPlantilla,
  type CotizacionPlantilla,
  type PlantillaVisibilidad,
} from "@/features/cotizacion/hooks/useCotizacionPlantillas";
import { EditarPlantillaDialog } from "@/features/cotizacion/components/plantillas/EditarPlantillaDialog";
import { PlantillasTabla } from "@/features/cotizacion/components/plantillas/PlantillasTabla";
import { ListSkeleton } from "@/components/shared/states/ListSkeleton";

type FiltroVis = "todos" | PlantillaVisibilidad;

export default function CotizacionPlantillas() {
  const navigate = useNavigate();
  const { organizationId } = useAuth();
  const { data: plantillas = [], isLoading } = useCotizacionPlantillas(organizationId);
  const eliminar = useEliminarPlantilla();

  const [busqueda, setBusqueda] = useState("");
  const [filtroVis, setFiltroVis] = useState<FiltroVis>("todos");
  const [editando, setEditando] = useState<CotizacionPlantilla | null>(null);
  const [aEliminar, setAEliminar] = useState<CotizacionPlantilla | null>(null);

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return plantillas.filter((p) => {
      if (filtroVis !== "todos" && p.visibilidad !== filtroVis) return false;
      if (!q) return true;
      return (
        p.nombre.toLowerCase().includes(q) ||
        (p.descripcion ?? "").toLowerCase().includes(q)
      );
    });
  }, [plantillas, busqueda, filtroVis]);

  const handleEliminar = async () => {
    if (!aEliminar || !organizationId) return;
    try {
      await eliminar.mutateAsync({ id: aEliminar.id, organizationId });
      notifySuccess(undefined, { title: "Plantilla eliminada" });
      setAEliminar(null);
    } catch (err) {
      notifyError(undefined, {
        title: "No se pudo eliminar",
        error: err,
        method: "CotizacionPlantillas.eliminar",
      });
    }
  };

  return (
    <PageContainer>
      <PageHeader
        title="Plantillas de cotización"
        description="Reutiliza cotizaciones frecuentes. Las plantillas se aplican desde el Paso 1 del wizard."
        icon={<Sparkles className="h-5 w-5" />}
        actions={
          <Button onClick={() => navigate("/cotizaciones/nueva")}>
            Nueva cotización
          </Button>
        }
      />

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Input
              placeholder="Buscar por nombre o descripción…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="max-w-xs"
              aria-label="Buscar plantilla"
            />
            <Select value={filtroVis} onValueChange={(v) => setFiltroVis(v as FiltroVis)}>
              <SelectTrigger className="w-[180px]" aria-label="Filtrar visibilidad">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas</SelectItem>
                <SelectItem value="yo">Sólo mías</SelectItem>
                <SelectItem value="org">Toda la organización</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground ml-auto">
              {filtradas.length} de {plantillas.length}
            </span>
          </div>

          {isLoading ? (
            <ListSkeleton variant="card" rows={3} />
          ) : filtradas.length === 0 ? (
            <div className="text-sm text-muted-foreground py-12 text-center space-y-2">
              <p>
                {plantillas.length === 0
                  ? "Aún no has guardado plantillas."
                  : "Sin resultados con esos filtros."}
              </p>
              {plantillas.length === 0 && (
                <p className="text-xs">
                  Guarda tu primera plantilla desde el diálogo "Cotización creada" al terminar el wizard.
                </p>
              )}
            </div>
          ) : (
            <PlantillasTabla
              plantillas={filtradas}
              onEditar={setEditando}
              onEliminar={setAEliminar}
              onUsar={() => navigate("/cotizaciones/nueva")}
            />
          )}
        </CardContent>
      </Card>

      {editando && (
        <EditarPlantillaDialog
          plantilla={editando}
          organizationId={organizationId}
          open={!!editando}
          onOpenChange={(o) => { if (!o) setEditando(null); }}
        />
      )}

      <DeleteConfirmDialog
        open={!!aEliminar}
        onOpenChange={(o) => { if (!o) setAEliminar(null); }}
        entityName={aEliminar?.nombre ?? ""}
        description="Esta acción elimina la plantilla. Las cotizaciones ya creadas con ella no se ven afectadas."
        onConfirm={handleEliminar}
        isPending={eliminar.isPending}
      />
    </PageContainer>
  );
}
