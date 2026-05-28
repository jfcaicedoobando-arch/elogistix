import { ERROR_CODES } from "@/lib/domain/errorCatalog";
/**
 * Diálogo para duplicar un embarque desde la página de detalle.
 *
 * v12.0.0-rc.14: ahora cada copia permite editar tipo_contenedor (dropdown
 * del catálogo), peso_kg, volumen_m3 y piezas — no sólo el número de
 * contenedor. Pre-llena con los datos del embarque origen para conservar
 * el flujo rápido cuando todas las copias comparten la misma carga, pero
 * habilita ajustar cada contenedor individualmente (caso real: un mismo
 * shipment con contenedores distintos).
 *
 * El RPC `duplicar_embarque_completo` ya acepta estos campos por copia.
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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { NumericInput } from "@/components/shared/NumericInput";
import { useToast } from "@/hooks/shared";
import { useDuplicarEmbarque } from "@/hooks/embarque";
import { useTiposContenedor } from "@/hooks/catalogos";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";
import type { EmbarqueRow } from "@/hooks/embarque";

const MAX_COPIAS = 5;

interface CopiaContenedor {
  num_contenedor: string;
  tipo_contenedor: string;
  peso_kg: number;
  volumen_m3: number;
  piezas: number;
}

interface Props {
  embarque: EmbarqueRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function defaultCopia(origen: EmbarqueRow, idx: number): CopiaContenedor {
  const base = origen.contenedor?.trim() ?? "";
  return {
    num_contenedor: base ? `${base}-COPIA${idx + 1}` : "",
    tipo_contenedor: origen.tipo_contenedor ?? "",
    peso_kg: Number(origen.peso_kg ?? 0),
    volumen_m3: Number(origen.volumen_m3 ?? 0),
    piezas: Number(origen.piezas ?? 0),
  };
}

export default function DialogDuplicarEmbarque({ embarque, open, onOpenChange }: Props) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const duplicar = useDuplicarEmbarque();
  const { data: tiposContenedor = [] } = useTiposContenedor();
  const [copias, setCopias] = useState<CopiaContenedor[]>([]);

  useEffect(() => {
    if (open) {
      setCopias([defaultCopia(embarque, 0)]);
    }
  }, [open, embarque]);

  const handleAgregar = () => {
    if (copias.length >= MAX_COPIAS) return;
    setCopias((prev) => [...prev, defaultCopia(embarque, prev.length)]);
  };

  const handleQuitar = (idx: number) => {
    setCopias((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateCampo = <K extends keyof CopiaContenedor>(
    idx: number, campo: K, value: CopiaContenedor[K],
  ) => {
    setCopias((prev) => prev.map((c, i) => (i === idx ? { ...c, [campo]: value } : c)));
  };

  const handleConfirmar = async () => {
    const limpias = copias.map((c) => ({
      ...c,
      num_contenedor: c.num_contenedor.trim(),
      tipo_contenedor: c.tipo_contenedor.trim(),
    }));

    if (limpias.some((c) => c.num_contenedor.length === 0)) {
      notifyError(toast, {
        title: "Faltan números de contenedor",
        description: "Captura el número de contenedor para cada copia.",
        method: "HANDLE_CONFIRMAR",
        errorCode: ERROR_CODES.VALIDATION_FAILED,
      });
      return;
    }
    if (limpias.some((c) => c.tipo_contenedor.length === 0)) {
      notifyError(toast, {
        title: "Falta tipo de contenedor",
        description: "Selecciona el tipo de contenedor para cada copia.",
        method: "HANDLE_CONFIRMAR",
        errorCode: ERROR_CODES.VALIDATION_FAILED,
      });
      return;
    }
    if (limpias.some((c) => c.peso_kg < 0 || c.volumen_m3 < 0 || c.piezas < 0)) {
      notifyError(toast, {
        title: "Valores inválidos",
        description: "Peso, volumen y piezas no pueden ser negativos.",
        method: "HANDLE_CONFIRMAR",
        errorCode: ERROR_CODES.VALIDATION_FAILED,
      });
      return;
    }

    try {
      const nuevos = await duplicar.mutateAsync({
        embarqueOrigen: embarque,
        copias: limpias,
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
        context: { embarqueOrigenId: embarque.id, copias: limpias.length },
        method: "HANDLE_CONFIRMAR",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Duplicar embarque {embarque.expediente}</DialogTitle>
          <DialogDescription>
            Se crearán nuevos embarques con los mismos datos (cliente, ruta, conceptos
            de venta/costo, documentos). Puedes ajustar tipo de contenedor, peso, volumen
            y piezas para cada copia.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[420px] overflow-y-auto pr-1 space-y-3">
          {copias.map((copia, idx) => (
            <div key={idx} className="rounded-md border p-3 space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">
                  Copia {idx + 1}
                </Label>
                {copias.length > 1 && (
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
              <div className="grid grid-cols-1 md:grid-cols-[1.4fr_1fr_100px_100px_80px] gap-2">
                <div className="space-y-1">
                  <Label htmlFor={`num-${idx}`} className="text-xs">Número de contenedor</Label>
                  <Input
                    id={`num-${idx}`}
                    value={copia.num_contenedor}
                    onChange={(e) => updateCampo(idx, "num_contenedor", e.target.value)}
                    placeholder="Número de contenedor"
                    autoComplete="off"
                    className="h-8"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Tipo</Label>
                  <Select
                    value={copia.tipo_contenedor || undefined}
                    onValueChange={(v) => updateCampo(idx, "tipo_contenedor", v)}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue placeholder="Tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      {tiposContenedor.map((t) => (
                        <SelectItem key={t.id} value={t.code}>
                          {t.code} — {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Peso (kg)</Label>
                  <NumericInput
                    value={copia.peso_kg}
                    onChange={(n) => updateCampo(idx, "peso_kg", n)}
                    decimals
                    aria-label="Peso en kilogramos"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Volumen (m³)</Label>
                  <NumericInput
                    value={copia.volumen_m3}
                    onChange={(n) => updateCampo(idx, "volumen_m3", n)}
                    decimals
                    aria-label="Volumen en metros cúbicos"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Piezas</Label>
                  <NumericInput
                    value={copia.piezas}
                    onChange={(n) => updateCampo(idx, "piezas", n)}
                    aria-label="Piezas"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAgregar}
          disabled={copias.length >= MAX_COPIAS}
          className="w-full"
        >
          <Plus className="h-4 w-4 mr-1" />
          Agregar copia ({copias.length}/{MAX_COPIAS})
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
