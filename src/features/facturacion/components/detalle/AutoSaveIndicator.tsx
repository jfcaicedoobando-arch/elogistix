/**
 * AutoSaveIndicator — chip sutil que muestra el estado de guardado automático
 * ("Guardando…", "Guardado hace Xs", "Sin guardar", "Error"). Uso en headers
 * de cards con auto-save (Google-Docs style).
 */
import { useEffect, useState } from "react";
import { Check, Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AutoSaveEstado } from "@/features/facturacion/hooks/useAutoSaveDatosFiscales";

interface Props {
  estado: AutoSaveEstado;
  ultimoGuardado: number | null;
}

function formatoRelativo(ts: number): string {
  const seg = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (seg < 5) return "hace un momento";
  if (seg < 60) return `hace ${seg}s`;
  const min = Math.round(seg / 60);
  return `hace ${min} min`;
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
        Guardado{ultimoGuardado ? ` ${formatoRelativo(ultimoGuardado)}` : ""}
      </span>
    );
  }
  return null;
}
