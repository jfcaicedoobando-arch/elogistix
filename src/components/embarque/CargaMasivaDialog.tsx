import { useState, useRef } from "react";
import { Upload, CheckCircle2, XCircle, FileSpreadsheet } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { parsearCSVEmbarques, type ErrorFila, type ResultadoParseo } from "@/lib/embarqueCsvTemplate";
import type { TablesInsert } from "@/integrations/supabase/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientes: { id: string; nombre: string }[];
}

export default function CargaMasivaDialog({ open, onOpenChange, clientes }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [resultado, setResultado] = useState<ResultadoParseo | null>(null);
  const [creando, setCreando] = useState(false);
  const [creados, setCreados] = useState<number | null>(null);

  const resetear = () => {
    setResultado(null);
    setCreando(false);
    setCreados(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleClose = (abierto: boolean) => {
    if (!abierto) resetear();
    onOpenChange(abierto);
  };

  const handleArchivo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const archivo = e.target.files?.[0];
    if (!archivo) return;

    const texto = await archivo.text();
    const res = parsearCSVEmbarques(texto, clientes, user?.email ?? '');
    setResultado(res);
    setCreados(null);
  };

  const handleCrear = async () => {
    if (!resultado || resultado.validos.length === 0) return;
    setCreando(true);

    try {
      let exitosos = 0;
      for (const embarque of resultado.validos) {
        const { error } = await supabase.from('embarques').insert(embarque);
        if (!error) exitosos++;
      }

      setCreados(exitosos);
      queryClient.invalidateQueries({ queryKey: ['embarques'] });
      toast({
        title: `${exitosos} embarque(s) creado(s)`,
        description: exitosos < resultado.validos.length
          ? `${resultado.validos.length - exitosos} fallaron al insertar`
          : 'Todos los embarques se crearon correctamente',
      });
    } catch {
      toast({ title: "Error al crear embarques", variant: "destructive" });
    } finally {
      setCreando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" /> Carga Masiva de Embarques
          </DialogTitle>
          <DialogDescription>
            Sube un archivo CSV con la plantilla de embarques. Se validarán los datos antes de crear.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Selector de archivo */}
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={() => fileRef.current?.click()}
              disabled={creando || creados !== null}
            >
              <Upload className="h-4 w-4 mr-2" /> Seleccionar CSV
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleArchivo}
            />
            {resultado && (
              <span className="text-sm text-muted-foreground">
                {resultado.validos.length + resultado.errores.length} fila(s) procesadas
              </span>
            )}
          </div>

          {/* Resultados */}
          {resultado && (
            <div className="space-y-3">
              <div className="flex gap-4">
                <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                  <CheckCircle2 className="h-3 w-3 mr-1" /> {resultado.validos.length} válida(s)
                </Badge>
                {resultado.errores.length > 0 && (
                  <Badge variant="secondary" className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                    <XCircle className="h-3 w-3 mr-1" /> {resultado.errores.length} con errores
                  </Badge>
                )}
              </div>

              {resultado.errores.length > 0 && (
                <ScrollArea className="h-48 rounded-md border p-3">
                  <div className="space-y-2">
                    {resultado.errores.map((err: ErrorFila) => (
                      <div key={err.fila} className="text-sm">
                        <span className="font-medium text-destructive">Fila {err.fila}:</span>
                        <ul className="ml-4 list-disc text-muted-foreground">
                          {err.errores.map((msg, j) => (
                            <li key={j}>{msg}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}

              {creados !== null && (
                <p className="text-sm font-medium text-green-700 dark:text-green-400">
                  ✅ {creados} embarque(s) creado(s) exitosamente
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)}>
            {creados !== null ? 'Cerrar' : 'Cancelar'}
          </Button>
          {resultado && resultado.validos.length > 0 && creados === null && (
            <Button onClick={handleCrear} disabled={creando}>
              {creando ? 'Creando...' : `Crear ${resultado.validos.length} embarque(s)`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
