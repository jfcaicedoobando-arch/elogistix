import { Check } from "lucide-react";
import { PORTAL } from "../landingCopy";

export function LandingPortal() {
  return (
    <section className="bg-muted/40 py-20 sm:py-24">
      <div className="mx-auto grid max-w-6xl gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:items-center">
        <div>
          <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-accent">
            Portal del Cliente
          </p>
          <h2 className="text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {PORTAL.title}
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">{PORTAL.desc}</p>
          <ul className="mt-6 space-y-3">
            {PORTAL.bullets.map((b) => (
              <li key={b} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full bg-accent/15 text-accent">
                  <Check className="h-3 w-3" />
                </span>
                <span className="text-foreground/85">{b}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Mockup decorativo del portal */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-overlay)]">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Portal · Cliente
              </p>
              <h4 className="text-lg font-semibold text-foreground">Mis embarques</h4>
            </div>
            <span className="rounded-full bg-[hsl(160_84%_39%/0.12)] px-3 py-1 text-xs font-semibold text-[hsl(160_84%_30%)]">
              3 activos
            </span>
          </div>

          {/* Stacked bar mock */}
          <div className="mb-5 rounded-xl bg-muted/60 p-4">
            <p className="mb-3 text-xs font-medium text-muted-foreground">Gasto por mes (MXN)</p>
            <div className="flex h-32 items-end gap-2">
              {[60, 45, 75, 50, 90, 70].map((h, i) => (
                <div key={i} className="flex flex-1 flex-col-reverse gap-1">
                  <div className="rounded bg-accent/80" data-h={`${h * 0.6}%`} style={{ height: `${h * 0.6}%` }} />
                  <div className="rounded bg-primary/70" data-h={`${h * 0.4}%`} style={{ height: `${h * 0.4}%` }} />
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            {[
              { folio: "LCG-2026-0142", origen: "Shanghái", destino: "Manzanillo", estado: "En tránsito" },
              { folio: "LCG-2026-0138", origen: "Rotterdam", destino: "Veracruz", estado: "En puerto" },
              { folio: "LCG-2026-0125", origen: "Los Ángeles", destino: "CDMX", estado: "Liberado" },
            ].map((e) => (
              <div key={e.folio} className="flex items-center justify-between rounded-lg border border-border bg-background p-3 text-sm">
                <div>
                  <p className="font-mono text-xs font-semibold text-foreground">{e.folio}</p>
                  <p className="text-xs text-muted-foreground">{e.origen} → {e.destino}</p>
                </div>
                <span className="text-xs font-medium text-accent">{e.estado}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
