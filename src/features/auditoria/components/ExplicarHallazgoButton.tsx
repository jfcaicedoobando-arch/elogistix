/**
 * ExplicarHallazgoButton — Botón Sparkles que abre un Popover con explicación IA
 * del hallazgo. Usa Lovable AI (Gemini) vía edge function.
 */
import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SectionHeading } from "@/components/shared/SectionHeading";
import { Hint } from "@/components/shared/Hint";
import { useExplicarHallazgo, type ExplicacionHallazgo } from "@/features/auditoria/hooks/useExplicarHallazgo";
import type { HallazgoAuditoria } from "@/features/auditoria/types";

interface Props {
  hallazgo: HallazgoAuditoria;
}

export function ExplicarHallazgoButton({ hallazgo }: Props) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<ExplicacionHallazgo | null>(null);
  const explicar = useExplicarHallazgo();

  // 13.85.10 — Toast de error vive en `useExplicarHallazgo` (mapea 402/429).
  // Aquí sólo guardamos la respuesta exitosa.
  const handleOpen = (next: boolean) => {
    setOpen(next);
    if (next && !data && !explicar.isPending) {
      explicar.mutate(hallazgo, {
        onSuccess: (res) => setData(res),
      });
    }
  };


  return (
    <Popover open={open} onOpenChange={handleOpen}>
      {/* Hint por fuera: `asChild` clona props en su hijo directo y `Hint` no
          las reenvía; invertido, el botón perdía el handler del popover. */}
      <Hint label="Explicar este hallazgo con IA">
        <PopoverTrigger asChild>
          <Button
            size="icon"
            variant="ghost"
            className="min-h-11 min-w-11 md:h-7 md:w-7 md:min-h-0 md:min-w-0 text-primary"
            onClick={(e) => e.stopPropagation()}
            aria-label="Explicar con IA"
          >
            <Sparkles className="h-3.5 w-3.5" />
          </Button>
        </PopoverTrigger>
      </Hint>

      <PopoverContent
        side="left"
        align="start"
        className="w-[420px] max-h-[480px] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-2 pb-2 border-b">
          <SectionHeading as="h3" variant="subsection" icon={<Sparkles className="h-4 w-4 text-primary" />}>
            Análisis IA del hallazgo
          </SectionHeading>
        </div>
        {explicar.isPending && (
          <div className="flex items-center gap-2 py-6 justify-center text-body text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Analizando contexto del embarque…
          </div>
        )}
        {!explicar.isPending && data && (
          <div className="prose prose-sm dark:prose-invert max-w-none text-body-sm leading-relaxed">
            <ReactMarkdown>{data.explicacion}</ReactMarkdown>
            <p className="mt-3 text-label text-muted-foreground italic border-t pt-2">
              Generado por {data.modelo}. Verifica antes de actuar.
            </p>
          </div>
        )}
        {!explicar.isPending && !data && explicar.isError && (
          <p className="text-body-sm text-destructive py-4">
            No se pudo generar la explicación. Intenta de nuevo.
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}
