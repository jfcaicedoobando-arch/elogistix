import { ShieldCheck } from "lucide-react";
import { SEGURIDAD } from "../landingCopy";

export function LandingSeguridad() {
  return (
    <section className="bg-background py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-accent/10 px-3 py-1 text-sm font-medium text-accent">
            <ShieldCheck className="h-4 w-4" /> Seguridad
          </div>
          <h2 className="text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Tu información, blindada a nivel base de datos
          </h2>
        </div>

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {SEGURIDAD.map((s) => (
            <div key={s.title} className="rounded-xl border border-border bg-card p-6">
              <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <h3 className="mb-1.5 text-base font-semibold tracking-tight text-foreground">
                {s.title}
              </h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {s.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
