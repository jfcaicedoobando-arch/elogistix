/**
 * Sección de la vista detalle del embarque: gestiona los N contenedores hijos.
 * Permite agregar, editar y eliminar contenedores con un solo "Guardar cambios".
 */
import { useEffect, useState } from "react";
import { Save, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/shared";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";
import { getErrorMessage } from "@/lib/errors";
import {
  useContenedoresEmbarque,
  CONTENEDORES_QUERY_KEY,
} from "@/hooks/embarque";
import { reemplazarTodos } from "@/services/embarque";
import {
  rowAContenedorBorrador,
  type ContenedorBorrador,
} from "@/types/embarque/contenedor";
import { ListaContenedoresEditable } from "./ListaContenedoresEditable";

interface Props {
  embarqueId: string;
}

export function SeccionContenedores({ embarqueId }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: contenedoresDb = [], isLoading, error } =
    useContenedoresEmbarque(embarqueId);

  const [borradores, setBorradores] = useState<ContenedorBorrador[]>([]);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setBorradores(contenedoresDb.map(rowAContenedorBorrador));
    setDirty(false);
  }, [contenedoresDb]);

  const handleChange = (next: ContenedorBorrador[]) => {
    setBorradores(next);
    setDirty(true);
  };

  const handleGuardar = async () => {
    const invalidos = borradores.some(
      (b) => !b.numero_contenedor.trim() || !b.tipo_contenedor.trim(),
    );
    if (invalidos) {
      notifyError(toast, {
        title: "Faltan datos",
        description: "Cada contenedor requiere número y tipo.",
        method: "SECCION_CONTENEDORES",
      });
      return;
    }

    setSaving(true);
    try {
      await reemplazarTodos(
        embarqueId,
        borradores.map((b, i) => ({ ...b, orden: i + 1 })),
      );
      await queryClient.invalidateQueries({
        queryKey: [CONTENEDORES_QUERY_KEY, embarqueId],
      });
      await queryClient.invalidateQueries({ queryKey: ["embarques"] });
      notifySuccess(toast, {
        title: "Contenedores actualizados",
        description: `Se guardaron ${borradores.length} contenedor(es).`,
      });
      setDirty(false);
    } catch (err) {
      notifyError(toast, {
        title: "Error al guardar contenedores",
        description: getErrorMessage(err),
        error: err,
        method: "SECCION_CONTENEDORES",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3">
        <div>
          <CardTitle className="text-sm">
            Contenedores ({borradores.length})
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Un embarque puede tener múltiples contenedores. Agrega o edita los que
            apliquen.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          onClick={handleGuardar}
          disabled={!dirty || saving}
        >
          {saving ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-1" />
          )}
          Guardar cambios
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
        ) : (
          <ListaContenedoresEditable
            value={borradores}
            onChange={handleChange}
            disabled={saving}
            minRows={0}
          />
        )}
      </CardContent>
    </Card>
  );
}
