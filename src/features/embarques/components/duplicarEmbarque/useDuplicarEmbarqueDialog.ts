/**
 * Hook con la lógica de estado y validación del diálogo de duplicar embarque.
 * Extraído de `DialogDuplicarEmbarque` en 12.1.0 (Power of 10).
 */
import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ERROR_CODES } from "@/lib/domain/errorCatalog";
import { useDuplicarEmbarque } from "@/features/embarques/hooks";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";
import type { EmbarqueRow } from "@/features/embarques/hooks";
import { type CopiaContenedor, MAX_COPIAS } from "./types";

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

function validate(copias: CopiaContenedor[]): string | null {
  if (copias.some((c) => c.num_contenedor.length === 0)) {
    return "Captura el número de contenedor para cada copia.";
  }
  if (copias.some((c) => c.tipo_contenedor.length === 0)) {
    return "Selecciona el tipo de contenedor para cada copia.";
  }
  if (copias.some((c) => c.peso_kg < 0 || c.volumen_m3 < 0 || c.piezas < 0)) {
    return "Peso, volumen y piezas no pueden ser negativos.";
  }
  return null;
}

interface Args {
  embarque: EmbarqueRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function useDuplicarEmbarqueDialog({ embarque, open, onOpenChange }: Args) {
  const navigate = useNavigate();
  const duplicar = useDuplicarEmbarque();
  const [copias, setCopias] = useState<CopiaContenedor[]>([]);

  useEffect(() => {
    if (open) setCopias([defaultCopia(embarque, 0)]);
  }, [open, embarque]);

  const handleAgregar = useCallback(() => {
    setCopias((prev) =>
      prev.length >= MAX_COPIAS ? prev : [...prev, defaultCopia(embarque, prev.length)],
    );
  }, [embarque]);

  const handleQuitar = useCallback((idx: number) => {
    setCopias((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const updateCampo = useCallback(
    <K extends keyof CopiaContenedor>(idx: number, campo: K, value: CopiaContenedor[K]) => {
      setCopias((prev) => prev.map((c, i) => (i === idx ? { ...c, [campo]: value } : c)));
    },
    [],
  );

  const handleConfirmar = useCallback(async () => {
    const limpias = copias.map((c) => ({
      ...c,
      num_contenedor: c.num_contenedor.trim(),
      tipo_contenedor: c.tipo_contenedor.trim(),
    }));
    const err = validate(limpias);
    if (err) {
      notifyError(undefined, {
        title: "Datos inválidos",
        description: err,
        method: "HANDLE_CONFIRMAR",
        errorCode: ERROR_CODES.VALIDATION_FAILED,
      });
      return;
    }

    try {
      const nuevos = await duplicar.mutateAsync({ embarqueOrigen: embarque, copias: limpias });
      notifySuccess(undefined, {
        title: nuevos.length === 1 ? "Embarque duplicado" : `${nuevos.length} embarques creados`,
        description: nuevos.map((n) => n.expediente).join(", "),
      });
      onOpenChange(false);
      if (nuevos.length > 0) navigate(`/embarques/${nuevos[0].id}`);
    } catch (error) {
      notifyError(undefined, {
        title: "No se pudo duplicar el embarque",
        phase: "duplicación de embarque",
        error,
        context: { embarqueOrigenId: embarque.id, copias: limpias.length },
        method: "HANDLE_CONFIRMAR",
      });
    }
  }, [copias, embarque, duplicar, onOpenChange, navigate]);

  return {
    copias,
    isPending: duplicar.isPending,
    handleAgregar,
    handleQuitar,
    updateCampo,
    handleConfirmar,
  };
}
