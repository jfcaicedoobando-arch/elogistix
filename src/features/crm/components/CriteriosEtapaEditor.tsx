/**
 * Editor de criterios de salida por etapa del pipeline.
 * Permite definir el checklist que una oportunidad debe cumplir antes de avanzar.
 */
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { notifyError } from "@/lib/ui/appFeedback";
import { ConfirmActionDialog } from "@/components/shared/dialogs/ConfirmActionDialog";
import { crmToast } from "@/features/crm/lib/crmToast";
import { ERROR_CODES } from "@/lib/domain/errorCatalog";
import { useEtapasPipeline } from "@/features/crm/hooks";
import {
  useCriteriosEtapa,
  useCrearCriterioEtapa,
  useActualizarCriterioEtapa,
  useEliminarCriterioEtapa,
} from "@/features/crm/hooks/useCriteriosEtapa";

export default function CriteriosEtapaEditor() {
  const { data: etapas = [] } = useEtapasPipeline();
  const [etapaId, setEtapaId] = useState<string>("");
  const etapaSel = etapaId || etapas[0]?.id || "";
  const { data: criterios = [], isLoading } = useCriteriosEtapa(etapaSel || undefined);
  const crear = useCrearCriterioEtapa();
  const actualizar = useActualizarCriterioEtapa();
  const eliminar = useEliminarCriterioEtapa();

  const [nombre, setNombre] = useState("");
  const [obligatorio, setObligatorio] = useState(true);
  // UX-13: el borrado pide confirmación y queda deshabilitado durante la mutación.
  const [criterioAEliminar, setCriterioAEliminar] = useState<{ id: string; nombre: string } | null>(
    null,
  );

  const handleAgregar = async () => {
    if (!nombre.trim() || !etapaSel) {
      return notifyError(undefined, {
        title: "Escribe el criterio y elige una etapa",
        method: "HANDLE_AGREGAR",
        errorCode: ERROR_CODES.VALIDATION_FAILED,
      });
    }
    try {
      await crear.mutateAsync({
        etapa_id: etapaSel,
        nombre: nombre.trim(),
        orden: criterios.length + 1,
        obligatorio,
      });
      setNombre("");
      crmToast.success("Criterio agregado");
    } catch {
      // useCrearCriterioEtapa ya notifica en onError; no duplicar el aviso.
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1 max-w-xs">
        <Label>Etapa</Label>
        <Select value={etapaSel} onValueChange={setEtapaId}>
          <SelectTrigger><SelectValue placeholder="Selecciona etapa" /></SelectTrigger>
          <SelectContent>
            {etapas.map((e) => (
              <SelectItem key={e.id} value={e.id}>{e.nombre}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        {isLoading ? <p className="text-body text-muted-foreground">Cargando…</p> : null}
        {!isLoading && criterios.length === 0 ? (
          <p className="text-body text-muted-foreground">
            Esta etapa aún no tiene criterios de salida.
          </p>
        ) : null}
        {criterios.map((c) => (
          <div key={c.id} className="flex items-center gap-3 rounded-md border border-border p-2">
            <Checkbox
              id={`obl-${c.id}`}
              checked={c.obligatorio}
              onCheckedChange={(v) =>
                actualizar.mutate({ id: c.id, patch: { obligatorio: v === true } })
              }
            />
            <Label htmlFor={`obl-${c.id}`} size="sm" className="cursor-pointer">Obligatorio</Label>
            <span className="text-body flex-1">{c.nombre}</span>
            {!c.activo ? <Badge variant="secondary">Inactivo</Badge> : null}
            <Button
              size="icon"
              variant="ghost"
              aria-label={`Eliminar criterio ${c.nombre}`}
              disabled={eliminar.isPending}
              onClick={() => setCriterioAEliminar({ id: c.id, nombre: c.nombre })}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1 flex-1 min-w-56">
          <Label htmlFor="nuevo-criterio">Nuevo criterio</Label>
          <Input
            id="nuevo-criterio"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej. Cliente confirmó volumen mensual"
          />
        </div>
        <div className="flex items-center gap-2 pb-2">
          <Checkbox
            id="nuevo-obligatorio"
            checked={obligatorio}
            onCheckedChange={(v) => setObligatorio(v === true)}
          />
          <Label htmlFor="nuevo-obligatorio" size="sm" className="cursor-pointer">Obligatorio</Label>
        </div>
        <Button onClick={handleAgregar} loading={crear.isPending}>
          <Plus className="h-4 w-4 mr-1" /> Agregar
        </Button>
      </div>

      <ConfirmActionDialog
        open={!!criterioAEliminar}
        onOpenChange={(open) => {
          if (!open) setCriterioAEliminar(null);
        }}
        title="Eliminar criterio"
        description={
          <>
            Se eliminará el criterio <strong>{criterioAEliminar?.nombre}</strong> de la etapa. Las
            oportunidades dejarán de exigirlo para avanzar.
          </>
        }
        confirmLabel="Eliminar"
        variant="destructive"
        isPending={eliminar.isPending}
        onConfirm={async () => {
          if (!criterioAEliminar) return;
          try {
            await eliminar.mutateAsync(criterioAEliminar.id);
            setCriterioAEliminar(null);
          } catch {
            // El onError del hook ya notifica; el diálogo queda abierto para reintentar.
          }
        }}
      />
    </div>
  );
}
