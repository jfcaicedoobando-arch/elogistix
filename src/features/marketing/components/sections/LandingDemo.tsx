import { useState } from "react";
import { Button } from "@/components/ui/button";
import { PlayCircle, Calendar } from "lucide-react";
import { FOOTER } from "../landingCopy";

/**
 * Demo de 60 segundos. Slot listo para video real en /demo-libre-carga.mp4.
 * Si el archivo no existe, muestra placeholder "Próximamente" con CTA mailto.
 */
export function LandingDemo() {
  const [videoError, setVideoError] = useState(false);
  const mailto = `mailto:${FOOTER.contact}?subject=${encodeURIComponent("Quiero una demo guiada de Libre Carga")}`;

  return (
    <section
      id="demo"
      aria-labelledby="demo-title"
      className="bg-background py-24 sm:py-32"
    >
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-accent">
            Demo · 60 segundos
          </p>
          <h2
            id="demo-title"
            className="text-balance text-4xl font-bold tracking-tight text-foreground sm:text-5xl"
          >
            Mira Libre Carga en 60 segundos
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Recorrido rápido: cotizar, convertir a embarque, dar tracking al cliente y facturar.
          </p>
        </div>

        <div className="relative mx-auto mt-10 aspect-video w-full max-w-4xl overflow-hidden rounded-2xl border border-border bg-primary shadow-[var(--shadow-overlay)]">
          {!videoError ? (
            <video
              className="h-full w-full object-cover"
              controls
              preload="metadata"
              poster="/og-image.jpg"
              onError={() => setVideoError(true)}
            >
              <source src="/demo-libre-carga.mp4" type="video/mp4" />
            </video>
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-primary text-primary-foreground">
              <span className="flex h-20 w-20 items-center justify-center rounded-full bg-accent/20 ring-1 ring-accent/40">
                <PlayCircle className="h-10 w-10 text-accent" />
              </span>
              <p className="text-lg font-semibold">Demo en producción</p>
              <p className="max-w-md text-center text-sm text-primary-foreground/75">
                Estamos grabando el recorrido oficial. Mientras tanto, podemos darte una demo guiada en vivo.
              </p>
              <span className="rounded-full bg-primary-foreground/10 px-3 py-1 text-xs font-semibold text-primary-foreground/85">
                0:60
              </span>
            </div>
          )}
        </div>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button asChild size="lg" variant="outline">
            <a href={mailto}>
              <Calendar className="mr-1 h-4 w-4" /> Agendar demo guiada
            </a>
          </Button>
        </div>
      </div>
    </section>
  );
}
