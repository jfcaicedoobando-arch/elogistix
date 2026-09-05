import { Check } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RECORRIDO } from "../../routes/landingRecorridoCopy";

type Paso = (typeof RECORRIDO.pasos)[number];

function PasoPanel({ paso }: { paso: Paso }) {
  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_1.05fr] lg:items-center">
      <div>
        <h3 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {paso.title}
        </h3>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground">{paso.desc}</p>
        <ul className="mt-6 space-y-3">
          {paso.bullets.map((b) => (
            <li key={b} className="flex items-start gap-3">
              <span className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full bg-accent/10 text-accent">
                <Check className="h-3 w-3" />
              </span>
              <span className="text-sm text-foreground/85">{b}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Maqueta con los mismos tokens de la app interna. */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-overlay sm:p-6">
        <div className="mb-4 flex items-center justify-between border-b border-border pb-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {paso.docLabel}
            </p>
            <p className="font-mono text-sm font-semibold text-foreground">{paso.folio}</p>
          </div>
          <span className="rounded-full bg-accent/10 px-2.5 py-0.5 text-xs font-semibold text-accent">
            {paso.estado}
          </span>
        </div>
        <dl className="grid grid-cols-2 gap-3">
          {paso.campos.map((c) => (
            <div key={c.label} className="rounded-lg bg-muted/50 p-3">
              <dt className="text-xs uppercase tracking-wider text-muted-foreground">{c.label}</dt>
              <dd className="mt-0.5 text-sm font-semibold text-foreground">{c.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}

/**
 * Recorrido del producto en tres pasos (cotización → embarque → cobro).
 * Las maquetas son ilustrativas y se sustituyen por capturas reales sin
 * cambiar la estructura.
 */
export function LandingRecorrido() {
  return (
    <section
      id="recorrido"
      aria-labelledby="recorrido-title"
      className="bg-muted/40 py-24 sm:py-32"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-accent">
            {RECORRIDO.eyebrow}
          </p>
          <h2
            id="recorrido-title"
            className="text-balance text-4xl font-bold tracking-tight text-foreground sm:text-5xl"
          >
            {RECORRIDO.title}
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">{RECORRIDO.subtitle}</p>
        </div>

        <Tabs defaultValue={RECORRIDO.pasos[0].id} className="mt-12">
          <TabsList className="mx-auto grid w-full max-w-md grid-cols-3">
            {RECORRIDO.pasos.map((p) => (
              <TabsTrigger key={p.id} value={p.id}>
                {p.tab}
              </TabsTrigger>
            ))}
          </TabsList>
          {RECORRIDO.pasos.map((p) => (
            <TabsContent key={p.id} value={p.id} className="mt-10">
              <PasoPanel paso={p} />
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </section>
  );
}
