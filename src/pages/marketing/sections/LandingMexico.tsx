import { Globe, Percent, TrendingUp, Anchor, Calendar, Lock, Languages, type LucideIcon } from "lucide-react";
import { MEXICO } from "../landingCopy";

const ICONS: Record<string, LucideIcon> = { Percent, TrendingUp, Anchor, Calendar, Lock, Languages };

export function LandingMexico() {
  return (
    <section
      aria-labelledby="mexico-title"
      className="bg-background py-24 sm:py-32"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-accent/10 px-3 py-1 text-sm font-medium text-accent">
            <Globe className="h-4 w-4" /> Hecho para México
          </div>
          <h2
            id="mexico-title"
            className="text-balance text-4xl font-bold tracking-tight text-foreground sm:text-5xl"
          >
            La única plataforma diseñada desde el primer día para forwarders mexicanos
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            No es un SaaS gringo traducido al español. Cada decisión técnica tiene
            en mente cómo operas tú.
          </p>
        </div>

        <div className="mt-16 grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
          {MEXICO.map((m) => {
            const Icon = ICONS[m.icon] ?? Globe;
            return (
              <div key={m.title} className="bg-background p-7 transition-colors hover:bg-muted/30">
                <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 text-accent">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mb-1.5 text-base font-semibold tracking-tight text-foreground">
                  {m.title}
                </h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {m.desc}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
