/**
 * ExplicarHallazgoButton — Botón Sparkles que abre un Popover con explicación IA
 * del hallazgo. Usa Lovable AI (Gemini) vía edge function.
 */
import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { useExplicarHallazgo, type ExplicacionHallazgo } from "@/features/auditoria/hooks/useExplicarHallazgo";
import type { HallazgoAuditoria } from "@/features/auditoria/types";

import { notifyError } from "@/components/shared/utils/appFeedback";
interface Props {
  hallazgo: HallazgoAuditoria;
}

export function ExplicarHallazgoButton({ hallazgo }: Props) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<ExplicacionHallazgo | null>(null);
  const explicar = useExplicarHallazgo();

  const handleOpen = (next: boolean) => {
    setOpen(next);
    if (next && !data && !explicar.isPending) {
      explicar.mutate(hallazgo, {
        onSuccess: (res) => setData(res),
        onError: (err) => {
          const msg = err instanceof Error ? err.message : "Error al explicar";
          notifyError(toast, { title: msg.includes("402") ? "Sin créditos IA disponibles" : msg.includes("429") ? "Demasiadas solicitudes, intenta en un momento" : "No se pudo generar la explicación", error: err, method: "FEATURES_AUDITORIA_COMPONENTS_EXPLICARHALLAZGOBUTTON_1" });
        },
      });
    }
  };

  return (
    <Popover open={open} onOpenChange={handleOpen}>
      <PopoverTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 text-primary"
          onClick={(e) => e.stopPropagation()}
          aria-label="Explicar con IA"
          title="Explicar este hallazgo con IA"
        >
          <Sparkles className="h-3.5 w-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        side="left"
        align="start"
        className="w-[420px] max-h-[480px] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 mb-2 pb-2 border-b">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">Análisis IA del hallazgo</span>
        </div>
        {explicar.isPending && (
          <div className="flex items-center gap-2 py-6 justify-center text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Analizando contexto del embarque…
          </div>
        )}
        {!explicar.isPending && data && (
          <div className="prose prose-sm dark:prose-invert max-w-none text-xs leading-relaxed">
            <ReactMarkdown>{data.explicacion}</ReactMarkdown>
            <p className="mt-3 text-[10px] text-muted-foreground italic border-t pt-2">
              Generado por {data.modelo}. Verifica antes de actuar.
            </p>
          </div>
        )}
        {!explicar.isPending && !data && explicar.isError && (
          <p className="text-xs text-destructive py-4">
            No se pudo generar la explicación. Intenta de nuevo.
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}
