import { Check, X } from "lucide-react";
import { ANTES_DESPUES } from "../../routes/landingCopy";

/**
 * Comparativa honesta "antes / después". Sólo describe capacidades que ya
 * existen en el sistema; no incluye cifras ni testimonios.
 */
export function LandingAntesDespues() {
  return (
    <section
      id="antes-despues"
      aria-labelledby="antes-despues-title"
      className="bg-background py-24 sm:py-32"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-accent">
            {ANTES_DESPUES.eyebrow}
          </p>
          <h2
            id="antes-despues-title"
            className="text-balance text-4xl font-bold tracking-tight text-foreground sm:text-5xl"
          >
            {ANTES_DESPUES.title}
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">{ANTES_DESPUES.subtitle}</p>
        </div>

        <div className="mt-14 grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-border bg-muted/40 p-6 sm:p-8">
            <h3 className="mb-5 flex items-center gap-2.5 text-lg font-semibold tracking-tight text-foreground">
              <span className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-destructive/10 text-destructive">
                <X className="h-4 w-4" />
              </span>
              {ANTES_DESPUES.antesTitle}
            </h3>
            <ul className="space-y-4">
              {ANTES_DESPUES.filas.map((f) => (
                <li key={f.antes} className="flex items-start gap-3">
                  <span
                    aria-hidden="true"
                    className="mt-1.5 h-1.5 w-1.5 flex-none rounded-full bg-muted-foreground/60"
                  />
                  <span className="text-sm leading-relaxed text-muted-foreground">{f.antes}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-accent/40 bg-card p-6 shadow-overlay sm:p-8">
            <h3 className="mb-5 flex items-center gap-2.5 text-lg font-semibold tracking-tight text-foreground">
              <span className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-accent text-accent-foreground">
                <Check className="h-4 w-4" />
              </span>
              {ANTES_DESPUES.despuesTitle}
            </h3>
            <ul className="space-y-4">
              {ANTES_DESPUES.filas.map((f) => (
                <li key={f.despues} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full bg-accent/10 text-accent">
                    <Check className="h-3 w-3" />
                  </span>
                  <span className="text-sm leading-relaxed text-foreground/85">{f.despues}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
