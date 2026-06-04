import { Globe } from "lucide-react";
import { MEXICO } from "../landingCopy";

export function LandingMexico() {
  return (
    <section className="bg-background py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-accent/10 px-3 py-1 text-sm font-medium text-accent">
            <Globe className="h-4 w-4" /> Hecho para México
          </div>
          <h2 className="text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            La única plataforma diseñada desde el primer día para forwarders mexicanos
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            No es un SaaS gringo traducido al español. Cada decisión técnica tiene
            en mente cómo operas tú.
          </p>
        </div>

        <div className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
          {MEXICO.map((m) => (
            <div key={m.title} className="bg-background p-6">
              <h3 className="mb-1.5 text-base font-semibold tracking-tight text-foreground">
                {m.title}
              </h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {m.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
