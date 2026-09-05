import { ShieldCheck, Lock, Users, Activity, DatabaseBackup, type LucideIcon } from "lucide-react";
import { SEGURIDAD } from "../../routes/landingCopy";

const ICONS: LucideIcon[] = [Lock, Users, Activity, DatabaseBackup];

export function LandingSeguridad() {
  return (
    <section
      aria-labelledby="seguridad-title"
      className="bg-background py-24 sm:py-32"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-accent/10 px-3 py-1 text-sm font-medium text-accent">
            <ShieldCheck className="h-4 w-4" /> Garantías
          </div>
          <h2
            id="seguridad-title"
            className="text-balance text-4xl font-bold tracking-tight text-foreground sm:text-5xl"
          >
            Lo que te garantizamos con tu información
          </h2>

        </div>

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {SEGURIDAD.map((s, i) => {
            const Icon = ICONS[i] ?? ShieldCheck;
            return (
              <div
                key={s.title}
                className="rounded-xl border border-border bg-card p-6 transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-overlay"
              >
                <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mb-1.5 text-base font-semibold tracking-tight text-foreground">
                  {s.title}
                </h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {s.desc}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
