/**
 * Editor CRUD de plantillas de mensaje (email / WhatsApp) en /crm/configuracion.
 */
import { useState } from "react";
import { Plus, Save, Trash2, MessageSquare, Mail } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ConfirmActionDialog } from "@/components/shared/dialogs/ConfirmActionDialog";
import { notifyError } from "@/lib/ui/appFeedback";
import {
  usePlantillasMensaje,
  useCrearPlantilla,
  useActualizarPlantilla,
  useEliminarPlantilla,
  type PlantillaCanal,
} from "@/features/crm/hooks";

import { ERROR_CODES } from "@/lib/domain/errorCatalog";
import { EmptyStateInline } from "@/components/empty/EmptyStateInline";
import { ErrorStateInline } from "@/components/empty/ErrorStateInline";
import { getErrorMessage } from "@/lib/domain/errorMessages";
const VARIABLES = ["{{contacto}}", "{{empresa}}", "{{vendedor}}", "{{monto}}", "{{moneda}}", "{{etapa}}"];


export default function PlantillasMensajeEditor() {
  const { data = [], isLoading, isError, error, refetch, isFetching } = usePlantillasMensaje(undefined, false);
  const crear = useCrearPlantilla();
  const actualizar = useActualizarPlantilla();
  const eliminar = useEliminarPlantilla();

  const [nuevo, setNuevo] = useState({ nombre: "", canal: "email" as PlantillaCanal, asunto: "", cuerpo: "" });
  const [aEliminar, setAEliminar] = useState<{ id: string; nombre: string } | null>(null);


  const handleCrear = async () => {
    if (!nuevo.nombre.trim() || !nuevo.cuerpo.trim()) {
      notifyError(undefined, { title: "Nombre y cuerpo son obligatorios", method: "HANDLE_CREAR", errorCode: ERROR_CODES.VALIDATION_FAILED });
      return;
    }
    await crear.mutateAsync(nuevo);
    setNuevo({ nombre: "", canal: nuevo.canal, asunto: "", cuerpo: "" });
  };

  const toggleActiva = (id: string, activa: boolean) =>
    actualizar.mutate({ id, patch: { activa: !activa } });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-primary" /> Plantillas de mensaje
        </CardTitle>
        <p className="text-body-sm text-muted-foreground">
          Variables: {VARIABLES.join(" · ")}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Form crear */}
        <div className="border rounded-md p-3 space-y-2 bg-muted/30">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_140px] gap-2">
            <Input
              aria-label="Nombre de la plantilla"
              placeholder="Nombre de la plantilla"
              value={nuevo.nombre}
              onChange={(e) => setNuevo((n) => ({ ...n, nombre: e.target.value }))}
            />
            <Select value={nuevo.canal} onValueChange={(v) => setNuevo((n) => ({ ...n, canal: v as PlantillaCanal }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="email">Correo</SelectItem>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {nuevo.canal === "email" && (
            <Input
              aria-label="Asunto (sólo email)"
              placeholder="Asunto (sólo email)"
              value={nuevo.asunto}
              onChange={(e) => setNuevo((n) => ({ ...n, asunto: e.target.value }))}
            />
          )}
          <Textarea
            rows={4}
            placeholder="Cuerpo del mensaje. Usa variables como {{contacto}} o {{empresa}}."
            value={nuevo.cuerpo}
            onChange={(e) => setNuevo((n) => ({ ...n, cuerpo: e.target.value }))}
          />
          <div className="flex justify-end">
            <Button size="sm" onClick={handleCrear} disabled={crear.isPending} loading={crear.isPending}>
              {!crear.isPending && <Plus className="h-4 w-4 mr-1" />}
              Agregar
            </Button>
          </div>
        </div>

        {/* Lista */}
        {isLoading ? (
          <EmptyStateInline loading message="Cargando…" />
        ) : isError ? (
          <ErrorStateInline
            title="No pudimos cargar las plantillas"
            message={getErrorMessage(error)}
            onRetry={() => void refetch()}
            retrying={isFetching}
          />
        ) : data.length === 0 ? (
          <EmptyStateInline icon={MessageSquare} message="Sin plantillas todavía" />
        ) : (
          <ul className="space-y-2">
            {data.map((p) => (
              <li key={p.id} className="border rounded-md p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {p.canal === "email" ? <Mail className="h-3.5 w-3.5 text-muted-foreground" /> : <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />}
                    <Input
                      defaultValue={p.nombre}
                      aria-label={`Nombre de la plantilla ${p.nombre}`}
                      className="h-8 font-medium"
                      onBlur={(e) => {
                        if (e.target.value !== p.nombre) actualizar.mutate({ id: p.id, patch: { nombre: e.target.value } });
                      }}
                    />
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Label size="sm" className="flex items-center gap-1">
                      <Switch checked={p.activa} onCheckedChange={() => toggleActiva(p.id, p.activa)} aria-label={p.activa ? `Desactivar plantilla ${p.nombre}` : `Activar plantilla ${p.nombre}`} />
                      Activa
                    </Label>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="min-h-11 min-w-11 md:h-8 md:w-8 md:min-h-0 md:min-w-0 text-destructive"
                      onClick={() => setAEliminar({ id: p.id, nombre: p.nombre })}
                      aria-label={`Eliminar plantilla ${p.nombre}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>

                  </div>
                </div>
                {p.canal === "email" && (
                  <Input
                    defaultValue={p.asunto}
                    aria-label={`Asunto de la plantilla ${p.nombre}`}
                    placeholder="Asunto"
                    className="h-8 text-body-sm"
                    onBlur={(e) => {
                      if (e.target.value !== p.asunto) actualizar.mutate({ id: p.id, patch: { asunto: e.target.value } });
                    }}
                  />
                )}
                <Textarea
                  defaultValue={p.cuerpo}
                  rows={3}
                  className="text-body-sm"
                  onBlur={(e) => {
                    if (e.target.value !== p.cuerpo) actualizar.mutate({ id: p.id, patch: { cuerpo: e.target.value } });
                  }}
                />
                <div className="flex items-center gap-1 text-label text-muted-foreground">
                  <Save className="h-3 w-3" /> Los cambios se guardan al salir del campo.
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <ConfirmActionDialog
        open={aEliminar !== null}
        onOpenChange={(v) => { if (!v) setAEliminar(null); }}
        title="Eliminar plantilla"
        description={
          <>
            Vas a eliminar la plantilla <strong>{aEliminar?.nombre}</strong>. Esta acción no se puede deshacer.
          </>
        }
        confirmLabel="Eliminar"
        variant="destructive"
        isPending={eliminar.isPending}
        onConfirm={async () => {
          if (!aEliminar) return;
          await eliminar.mutateAsync(aEliminar.id);
          setAEliminar(null);
        }}
      />
    </Card>
  );
}

