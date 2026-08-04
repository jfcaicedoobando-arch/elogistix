/**
 * Banner de restauración de borrador (P0 — v13.293.0).
 * Se muestra al entrar a "Nueva Cotización" si existe un borrador válido
 * (guardado hace <24 h) para el usuario actual.
 */
import { useMemo } from "react";
import { RotateCcw, X, FileClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatRelativo } from "@/lib/date/relativo";

interface Props {
  savedAt: number;
  onRestore: () => void;
  onDiscard: () => void;
}

export function DraftRestoreBanner({ savedAt, onRestore, onDiscard }: Props) {
  const relative = useMemo(() => formatRelativo(new Date(savedAt)), [savedAt]);
  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-3 rounded-md border border-primary/30 bg-primary/5 px-4 py-3 mb-4"
    >
      <FileClock className="h-5 w-5 [color:hsl(var(--primary))] shrink-0" aria-hidden />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">Tienes un borrador sin terminar</p>
        <p className="text-xs text-muted-foreground">
          Guardado automáticamente {relative}. ¿Retomar donde te quedaste?
        </p>
      </div>
      <div className="flex gap-2 shrink-0">
        <Button size="sm" variant="outline" onClick={onDiscard}>
          <X className="h-4 w-4 mr-1" /> Descartar
        </Button>
        <Button size="sm" onClick={onRestore}>
          <RotateCcw className="h-4 w-4 mr-1" /> Restaurar
        </Button>
      </div>
    </div>
  );
}
