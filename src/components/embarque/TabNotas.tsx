import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Send } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { useCreateNotaEmbarque } from "@/hooks/useEmbarques";
import { useRegistrarActividad } from "@/hooks/useBitacora";
import { getErrorMessage } from "@/lib/errorUtils";
import { useToast } from "@/hooks/use-toast";
import type { NotaEmbarqueRow } from "@/hooks/useEmbarques";

interface Props {
  notas: NotaEmbarqueRow[];
  embarqueId?: string;
}

export function TabNotas({ notas, embarqueId }: Props) {
  const [texto, setTexto] = useState("");
  const { user } = useAuth();
  const { canEdit } = usePermissions();
  const crearNota = useCreateNotaEmbarque();
  const registrarActividad = useRegistrarActividad();
  const { toast } = useToast();

  const handleSubmit = async () => {
    if (!texto.trim() || !embarqueId) return;
    try {
      await crearNota.mutateAsync({
        embarqueId,
        contenido: texto.trim(),
        usuario: user?.email ?? '',
      });
      registrarActividad.mutate({
        accion: 'agregar_nota',
        modulo: 'embarques',
        entidad_id: embarqueId,
        detalles: { nota: texto.trim() },
      });
      setTexto("");
      toast({ title: "Nota agregada" });
    } catch (err: unknown) {
      toast({ title: "Error al agregar nota", description: getErrorMessage(err), variant: "destructive" });
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm">Actividad y Notas</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {canEdit && embarqueId && (
          <div className="flex gap-2">
            <Textarea
              placeholder="Escribe una nota..."
              value={texto}
              onChange={e => setTexto(e.target.value)}
              className="min-h-[60px]"
            />
            <Button size="icon" className="shrink-0 self-end" onClick={handleSubmit} disabled={!texto.trim() || crearNota.isPending}>
              {crearNota.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        )}

        {notas.length > 0 ? (
          <div className="space-y-4">
            {notas.map(nota => (
              <div key={nota.id} className="flex gap-3 text-sm">
                <div className="flex flex-col items-center">
                  <div className={`h-2.5 w-2.5 rounded-full mt-1.5 ${
                    nota.tipo === 'cambio_estado' ? 'bg-accent' : nota.tipo === 'nota' ? 'bg-warning' : 'bg-muted-foreground'
                  }`} />
                  <div className="flex-1 w-px bg-border mt-1" />
                </div>
                <div className="pb-4">
                  <p className="font-medium">{nota.contenido}</p>
                  <p className="text-xs text-muted-foreground">{nota.usuario} · {new Date(nota.fecha).toLocaleString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-8">Sin actividad registrada</p>
        )}
      </CardContent>
    </Card>
  );
}
