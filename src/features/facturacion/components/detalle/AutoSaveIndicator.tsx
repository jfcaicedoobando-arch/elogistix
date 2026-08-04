/**
 * AutoSaveIndicator — chip sutil que muestra el estado de guardado automático
 * ("Guardando…", "Guardado hace Xs", "Sin guardar", "Error"). Uso en headers
 * de cards con auto-save (Google-Docs style).
 */
import { useEffect, useState } from "react";
import { Check, Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatRelativo } from "@/lib/date/relativo";
import type { AutoSaveEstado } from "@/features/facturacion/hooks/useAutoSaveDatosFiscales";

interface Props {
  estado: AutoSaveEstado;
  ultimoGuardado: number | null;
}

export function AutoSaveIndicator({ estado, ultimoGuardado }: Props) {
  // Refresca el tiempo relativo cada 15 s mientras la card esté visible.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!ultimoGuardado) return;
    const t = setInterval(() => setTick((n) => n + 1), 15_000);
    return () => clearInterval(t);
  }, [ultimoGuardado]);

  if (estado === "saving") {
    return (
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" /> Guardando…
      </span>
    );
  }
  if (estado === "error") {
    return (
      <span className="flex items-center gap-1 text-xs text-destructive">
        <AlertCircle className="h-3 w-3" /> No se guardó
      </span>
    );
  }
  if (estado === "saved" || ultimoGuardado) {
    return (
      <span className={cn("flex items-center gap-1 text-xs text-success")}>
        <Check className="h-3 w-3" />
        Guardado{ultimoGuardado ? ` ${formatRelativo(new Date(ultimoGuardado))}` : ""}
      </span>
    );
  }
  return null;
}
