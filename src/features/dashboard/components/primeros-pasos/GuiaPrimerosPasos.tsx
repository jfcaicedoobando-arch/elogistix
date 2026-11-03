import { useCallback, useId, useLayoutEffect, useRef, useState } from "react";
import { BookOpen, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { usePrimerosPasos } from "@/features/dashboard/hooks/usePrimerosPasos";
import type { ResultadoPrimerosPasos } from "@/features/dashboard/domain/primerosPasos";
import { ContenidoPrimerosPasos } from "./ContenidoPrimerosPasos";

interface Props {
  ubicacion?: "inicio" | "ayuda";
}

export function GuiaPrimerosPasos({ ubicacion = "inicio" }: Props) {
  const { resultado, claveContexto, reintentar } = usePrimerosPasos();
  const restaurarFoco = useRef(false);
  const registrarFocoPrevio = useCallback((dentro: boolean) => {
    restaurarFoco.current = dentro;
  }, []);
  const consumirFocoPrevio = useCallback(() => {
    const pendiente = restaurarFoco.current;
    restaurarFoco.current = false;
    return pendiente;
  }, []);
  return (
    <PanelPrimerosPasos
      key={claveContexto}
      resultado={resultado}
      ubicacion={ubicacion}
      onRetry={reintentar}
      registrarFocoPrevio={registrarFocoPrevio}
      consumirFocoPrevio={consumirFocoPrevio}
    />
  );
}

interface PanelProps extends Props {
  resultado: ResultadoPrimerosPasos;
  onRetry: () => Promise<void>;
  registrarFocoPrevio: (dentro: boolean) => void;
  consumirFocoPrevio: () => boolean;
}

/** La apertura y las tareas expandidas sólo viven mientras el contexto siga vigente. */
export function PanelPrimerosPasos({ resultado, ubicacion, onRetry, registrarFocoPrevio, consumirFocoPrevio }: PanelProps) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const tituloId = useId();
  const titulo = ubicacion === "ayuda" ? "Ver guía de primeros pasos" : "Empieza por tu tarea";

  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (consumirFocoPrevio()) triggerRef.current?.focus();
    return () => {
      // Capturar antes de retirar el nodo; el foco externo debe permanecer fuera.
      registrarFocoPrevio(panel?.contains(document.activeElement) ?? false);
    };
  }, [registrarFocoPrevio, consumirFocoPrevio]);

  const reintentar = () => {
    if (panelRef.current?.contains(document.activeElement)) triggerRef.current?.focus();
    return onRetry();
  };

  return (
    <Card ref={panelRef}>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CardHeader className="p-4">
          <h2 id={tituloId}>
            <CollapsibleTrigger asChild>
              <Button ref={triggerRef} variant="ghost" className="h-auto min-h-11 w-full justify-between whitespace-normal text-left p-0 hover:bg-transparent">
                <span className="flex min-w-0 items-center gap-2 text-section">
                  <BookOpen className="h-5 w-5 shrink-0" aria-hidden />
                  {titulo}
                </span>
                <ChevronDown className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
              </Button>
            </CollapsibleTrigger>
          </h2>
          <p className="text-body text-muted-foreground">
            Elige qué necesitas hacer. Aquí encontrarás el punto de partida y el siguiente paso de cada tarea.
            {" "}Las opciones disponibles dependen de tu acceso en la organización activa.
          </p>
        </CardHeader>
        <CollapsibleContent>
          <CardContent role="region" aria-labelledby={tituloId} className="px-4 pb-4 pt-0">
            <ContenidoPrimerosPasos resultado={resultado} onRetry={reintentar} />
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
