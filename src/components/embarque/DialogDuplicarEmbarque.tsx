/**
 * Diálogo para duplicar un embarque desde la página de detalle (v11.47.0).
 *
 * UX: el usuario define cuántas copias (1..5) y captura el número de
 * contenedor para cada una. Los demás campos (tipo_contenedor, peso_kg,
 * volumen_m3, piezas) se heredan del embarque origen — coincide con la
 * realidad operativa (un embarque suele duplicarse para repartir un mismo
 * shipment en varios contenedores con misma carga).
 *
 * El RPC `duplicar_embarque_completo` devuelve `{ id, expediente }[]`; al
 * éxito navegamos al primer nuevo embarque y mostramos toast con el
 * conteo total.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Plus, Trash2 } from "lucide-react";

import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/shared";
import { useDuplicarEmbarque } from "@/hooks/embarque";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";
import type { EmbarqueRow } from "@/hooks/embarque";

const MAX_COPIAS = 5;

interface Props {
  embarque: EmbarqueRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function defaultNumContenedor(origen: EmbarqueRow, idx: number): string {
  const base = origen.num_contenedor?.trim() ?? "";
  if (!base) return "";
  return `${base}-COPIA${idx + 1}`;
}

export default function DialogDuplicarEmbarque({ embarque, open, onOpenChange }: Props) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const duplicar = useDuplicarEmbarque();
  const [contenedores, setContenedores] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      setContenedores([defaultNumContenedor(embarque, 0)]);
    }
  }, [open, embarque]);

  const handleAgregar = () => {
    if (contenedores.length >= MAX_COPIAS) return;
    setContenedores((prev) => [...prev, defaultNumContenedor(embarque, prev.length)]);
  };

  const handleQuitar = (idx: number) => {
    setContenedores((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleCambiar = (idx: number, value: string) => {
    setContenedores((prev) => prev.map((v, i) => (i === idx ? value : v)));
  };

  const handleConfirmar = async () => {
    const limpios = contenedores.map((c) => c.trim());
    if (limpios.some((c) => c.length === 0)) {
      notifyError(toast, {
        title: "Faltan números de contenedor",
        description: "Captura el número de contenedor para cada copia.",
      });
      return;
    }

    const copias = limpios.map((num_contenedor) => ({
      num_contenedor,
      tipo_contenedor: embarque.tipo_contenedor ?? "",
      peso_kg: Number(embarque.peso_kg ?? 0),
      volumen_m3: Number(embarque.volumen_m3 ?? 0),
      piezas: Number(embarque.piezas ?? 0),
    }));

    try {
      const nuevos = await duplicar.mutateAsync({
        embarqueOrigen: embarque,
        copias,
      });
      notifySuccess(toast, {
        title: nuevos.length === 1 ? "Embarque duplicado" : `${nuevos.length} embarques creados`,
        description: nuevos.map((n) => n.expediente).join(", "),
      });
      onOpenChange(false);
      if (nuevos.length > 0) {
        navigate(`/embarques/${nuevos[0].id}`);
      }
    } catch (error) {
      notifyError(toast, {
        title: "No se pudo duplicar el embarque",
        phase: "duplicación de embarque",
        error,
        context: { embarqueOrigenId: embarque.id, copias: copias.length },
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Duplicar embarque {embarque.expediente}</DialogTitle>
          <DialogDescription>
            Se crearán nuevos embarques con los mismos datos (cliente, ruta, conceptos
            de venta/costo, documentos) cambiando únicamente el número de contenedor.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-72 pr-3">
          <div className="space-y-3">
            {contenedores.map((valor, idx) => (
              <div key={idx} className="space-y-1">
                <Label htmlFor={`copia-${idx}`} className="text-xs text-muted-foreground">
                  Copia {idx + 1}
                </Label>
                <div className="flex gap-2">
                  <Input
                    id={`copia-${idx}`}
                    value={valor}
                    onChange={(e) => handleCambiar(idx, e.target.value)}
                    placeholder="Número de contenedor"
                    autoComplete="off"
                  />
                  {contenedores.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleQuitar(idx)}
                      aria-label={`Quitar copia ${idx + 1}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAgregar}
          disabled={contenedores.length >= MAX_COPIAS}
          className="w-full"
        >
          <Plus className="h-4 w-4 mr-1" />
          Agregar copia ({contenedores.length}/{MAX_COPIAS})
        </Button>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={duplicar.isPending}>
            Cancelar
          </Button>
          <Button onClick={handleConfirmar} disabled={duplicar.isPending}>
            {duplicar.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Duplicar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
