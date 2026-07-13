/**
 * CotizacionPlantillas — Gestión de plantillas de cotización (P2 cierre v13.296.0).
 *
 * - Listado con búsqueda, filtro por visibilidad.
 * - Editar metadatos (nombre/descripción/visibilidad).
 * - Eliminar con doble confirmación tipable "ELIMINAR".
 */
"use memo";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Sparkles, MoreVertical, Pencil, Trash2, ArrowUpRight } from "lucide-react";
import { PageContainer } from "@/components/shared/PageContainer";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DeleteConfirmDialog } from "@/components/shared/dialogs/DeleteConfirmDialog";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { FormDialogSection } from "@/components/shared/FormDialogSection";
import { formatDate } from "@/lib/formatters";
import { useAuth } from "@/lib/contexts/AuthContext";
import {
  useCotizacionPlantillas,
  useActualizarPlantilla,
  useEliminarPlantilla,
  type CotizacionPlantilla,
  type PlantillaVisibilidad,
} from "@/features/cotizacion/hooks/useCotizacionPlantillas";

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
      toast.success("Plantilla eliminada");
      setAEliminar(null);
    } catch (err) {
      toast.error("No se pudo eliminar", {
        description: err instanceof Error ? err.message : undefined,
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
            <div className="text-sm text-muted-foreground py-8 text-center">Cargando…</div>
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
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase text-muted-foreground border-b">
                  <tr>
                    <th className="text-left py-2 px-2">Nombre</th>
                    <th className="text-left py-2 px-2">Descripción</th>
                    <th className="text-left py-2 px-2">Visibilidad</th>
                    <th className="text-right py-2 px-2">Usos</th>
                    <th className="text-left py-2 px-2">Actualizada</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {filtradas.map((p, i) => (
                    <tr
                      key={p.id}
                      className={i % 2 === 0 ? "bg-background" : "bg-muted/20"}
                      data-testid={`plantilla-row-${p.id}`}
                    >
                      <td className="py-2 px-2 font-medium">{p.nombre}</td>
                      <td className="py-2 px-2 text-muted-foreground max-w-[280px] truncate">
                        {p.descripcion ?? "—"}
                      </td>
                      <td className="py-2 px-2">
                        <Badge variant={p.visibilidad === "org" ? "default" : "secondary"}>
                          {p.visibilidad === "org" ? "Organización" : "Sólo yo"}
                        </Badge>
                      </td>
                      <td className="py-2 px-2 text-right tabular-nums">{p.veces_usada}</td>
                      <td className="py-2 px-2 text-muted-foreground">
                        {formatDate(p.updated_at)}
                      </td>
                      <td className="py-2 px-2">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => e.stopPropagation()}
                              aria-label={`Acciones ${p.nombre}`}
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={(e) => { e.stopPropagation(); setEditando(p); }}
                            >
                              <Pencil className="h-4 w-4 mr-2" /> Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={(e) => { e.stopPropagation(); navigate("/cotizaciones/nueva"); }}
                            >
                              <ArrowUpRight className="h-4 w-4 mr-2" /> Usar en cotización
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={(e) => { e.stopPropagation(); setAEliminar(p); }}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" /> Eliminar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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

// ─── EditarPlantillaDialog ────────────────────────────────────────────────

interface EditProps {
  plantilla: CotizacionPlantilla;
  organizationId: string | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

function EditarPlantillaDialog({ plantilla, organizationId, open, onOpenChange }: EditProps) {
  const [nombre, setNombre] = useState(plantilla.nombre);
  const [descripcion, setDescripcion] = useState(plantilla.descripcion ?? "");
  const [visibilidad, setVisibilidad] = useState<PlantillaVisibilidad>(plantilla.visibilidad);
  const actualizar = useActualizarPlantilla();

  const puede = !!organizationId && nombre.trim().length >= 3;

  const handleGuardar = async () => {
    if (!puede || !organizationId) return;
    try {
      await actualizar.mutateAsync({
        id: plantilla.id,
        organizationId,
        nombre,
        descripcion,
        visibilidad,
      });
      toast.success("Plantilla actualizada");
      onOpenChange(false);
    } catch (err) {
      toast.error("No se pudo actualizar", {
        description: err instanceof Error ? err.message : undefined,
      });
    }
  };

  return (
    <FormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={Pencil}
      title="Editar plantilla"
      description="Actualiza el nombre, la descripción o la visibilidad. El contenido de la cotización base se preserva."
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={actualizar.isPending}>
            Cancelar
          </Button>
          <Button onClick={handleGuardar} disabled={!puede || actualizar.isPending}>
            Guardar cambios
          </Button>
        </>
      }
    >
      <FormDialogSection title="Identificación" cols={1}>
        <div className="space-y-1.5">
          <Label htmlFor="ep-nombre">Nombre <span className="text-destructive">*</span></Label>
          <Input
            id="ep-nombre"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            maxLength={80}
            autoFocus
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ep-desc">Descripción</Label>
          <Textarea
            id="ep-desc"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            rows={2}
            maxLength={200}
          />
        </div>
      </FormDialogSection>

      <FormDialogSection title="Visibilidad" flat>
        <RadioGroup value={visibilidad} onValueChange={(v) => setVisibilidad(v as PlantillaVisibilidad)}>
          <div className="flex items-start gap-2">
            <RadioGroupItem value="yo" id="ep-vis-yo" className="mt-1" />
            <Label htmlFor="ep-vis-yo" className="font-normal cursor-pointer">
              <span className="font-medium">Sólo yo</span>
            </Label>
          </div>
          <div className="flex items-start gap-2">
            <RadioGroupItem value="org" id="ep-vis-org" className="mt-1" />
            <Label htmlFor="ep-vis-org" className="font-normal cursor-pointer">
              <span className="font-medium">Toda la organización</span>
            </Label>
          </div>
        </RadioGroup>
      </FormDialogSection>
    </FormDialogShell>
  );
}
