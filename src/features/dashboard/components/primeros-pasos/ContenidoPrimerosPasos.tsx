import { Link } from "react-router";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ErrorState } from "@/components/shared/states/ErrorState";
import { EmptyStateInline } from "@/components/empty/EmptyStateInline";
import type { ResultadoPrimerosPasos } from "@/features/dashboard/domain/primerosPasos";

interface Props {
  resultado: ResultadoPrimerosPasos;
  onRetry: () => Promise<void>;
}

const AVISOS = {
  "sin-sesion": "Esta es una guía general del ERP. Consulta las preguntas frecuentes y el glosario. Inicia sesión para ver los puntos de partida disponibles para tu rol y tu organización.",
  "sin-rol": "Tu cuenta aún no tiene un rol disponible para esta guía. Pide al administrador de tu organización que revise tu acceso.",
  "sin-organizacion": "No hay una organización activa para mostrar tareas del ERP. Revisa tu acceso con el administrador de tu organización.",
} as const;

export function ContenidoPrimerosPasos({ resultado, onRetry }: Props) {
  if (resultado.estado === "cargando") {
    return (
      <p role="status" className="flex items-center gap-2 text-body text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        Cargando las opciones de tu guía…
      </p>
    );
  }
  if (resultado.estado === "error-perfil" || resultado.estado === "error-organizaciones") {
    const esPerfil = resultado.estado === "error-perfil";
    return (
      <ErrorState
        title="No pudimos cargar el contexto de tu guía"
        description={esPerfil ? "No se pudo verificar tu cuenta y su rol. Reintenta la carga antes de elegir una tarea." : "No se pudo cargar la lista de organizaciones. Reintenta la carga antes de elegir una tarea."}
        retryLabel={esPerfil ? "Reintentar carga de cuenta" : "Reintentar carga de organizaciones"}
        onRetry={() => void onRetry()}
      />
    );
  }
  if (resultado.estado !== "disponible") {
    return (
      <div className="space-y-3 text-body text-muted-foreground">
        <p role="status">{AVISOS[resultado.estado]}</p>
        {resultado.estado === "sin-sesion" && (
          <Button variant="outline" size="sm" asChild><Link to="/login">Iniciar sesión</Link></Button>
        )}
      </div>
    );
  }
  if (resultado.tareas.length === 0) {
    return (
      <div role="status">
        <EmptyStateInline
          density="compact"
          message="No hay tareas de esta guía disponibles para tu acceso actual. Consulta las preguntas frecuentes de los módulos que puedes abrir."
        />
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <p className="text-body-sm text-muted-foreground">
        Abre una tarea para revisar sus requisitos y elegir dónde empezar.
      </p>
      <Accordion type="single" collapsible>
        {resultado.tareas.map((tarea) => (
          <AccordionItem key={tarea.id} value={tarea.id}>
            <AccordionTrigger className="text-left text-body">{tarea.titulo}</AccordionTrigger>
            <AccordionContent className="space-y-3 text-body text-muted-foreground">
              <p>{tarea.descripcion}</p>
              {tarea.requisito && <p>{tarea.requisito}</p>}
              <div className="flex flex-wrap gap-2">
                {tarea.enlaces.map((enlace) => (
                  <Button key={enlace.href} variant="outline" size="sm" className="h-auto min-h-10 whitespace-normal py-2" asChild>
                    <Link to={enlace.href}>{enlace.etiqueta}</Link>
                  </Button>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
