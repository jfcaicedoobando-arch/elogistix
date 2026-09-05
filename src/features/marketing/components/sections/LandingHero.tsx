import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle2, Ship, Container, FileText, Clock } from "lucide-react";
import { HERO, PROOF_TITLE, PROOF_NAVIERAS, PROOF_ESTANDARES, PROOF_DISCLAIMER } from "../../routes/landingCopy";
import { ProbarDemoButton } from "@/features/marketing/components/ProbarDemoButton";

export function LandingHero() {
  return (
    <section
      aria-labelledby="hero-title"
      className="relative overflow-hidden bg-primary text-primary-foreground"
    >
      {/* Grid pattern + radial glow */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 opacity-[0.08] bg-grid-hero" />

        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-accent/20 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 h-[28rem] w-[28rem] rounded-full bg-info/15 blur-3xl" />


      </div>

      <div className="relative mx-auto grid max-w-6xl gap-14 px-4 py-24 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:py-32">
        <div className="flex flex-col justify-center">
          <span className="mb-5 inline-flex w-fit items-center gap-2 rounded-full border border-primary-foreground/25 bg-primary-foreground/10 px-3 py-1 text-xs font-medium uppercase tracking-wider text-primary-foreground/95">
            {HERO.eyebrow}
          </span>
          <h1
            id="hero-title"
            className="text-balance text-5xl font-bold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl"
          >
            {HERO.h1}
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-primary-foreground/85">
            {HERO.sub}
          </p>


          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90">
              <Link to="/login?tab=signup">
                {HERO.primaryCta} <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
            <ProbarDemoButton
              size="lg"
              variant="outline"
              className="border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
            />
          </div>

          <p className="mt-5 flex items-center gap-2 text-sm text-primary-foreground/75">
            <CheckCircle2 className="h-4 w-4 text-accent" />
            Sin tarjeta de crédito. Usuarios ilimitados.
          </p>
        </div>

        {/* Mockup: vista de Embarque real */}
        <div className="relative flex items-center justify-center">
          <div className="w-full max-w-md rounded-2xl border border-primary-foreground/15 bg-primary-foreground/[0.06] p-5 shadow-2xl backdrop-blur-sm">
            <div className="mb-4 flex items-center justify-between border-b border-primary-foreground/10 pb-3">
              <div>
                <p className="text-2xs font-semibold uppercase tracking-wider text-primary-foreground/80">
                  Embarque · FCL
                </p>
                <p className="font-mono text-sm font-semibold">LCG-2026-0142</p>
              </div>
              <span className="rounded-full bg-primary-foreground/15 px-2.5 py-0.5 text-xs font-semibold text-primary-foreground">
                En tránsito
              </span>
            </div>

            <div className="mb-4 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg bg-primary-foreground/[0.06] p-2.5">
                <p className="text-2xs uppercase tracking-wider text-primary-foreground/75">BL Master</p>
                <p className="font-mono text-sm font-semibold">MAEU-794821</p>
              </div>
              <div className="rounded-lg bg-primary-foreground/[0.06] p-2.5">
                <p className="text-2xs uppercase tracking-wider text-primary-foreground/75">Naviera</p>
                <p className="text-sm font-semibold">Maersk</p>
              </div>
            </div>

            {/* Ruta */}
            <div className="mb-4 flex items-center gap-2 text-xs">
              <div className="flex-1 text-left">
                <p className="text-2xs uppercase tracking-wider text-primary-foreground/80">Origen</p>
                <p className="font-semibold text-primary-foreground">Shanghái CNSHA</p>
              </div>
              <Ship className="h-4 w-4 text-primary-foreground" />
              <div className="flex-1 text-right">
                <p className="text-2xs uppercase tracking-wider text-primary-foreground/80">Destino</p>
                <p className="font-semibold text-primary-foreground">Manzanillo MZLO</p>
              </div>
            </div>

            {/* Timeline */}
            <div className="space-y-2">
              {[
                { icon: FileText, label: "BL emitido", date: "12/05/2026", done: true },
                { icon: Ship, label: "Zarpado", date: "16/05/2026", done: true },
                { icon: Container, label: "ETA puerto", date: "08/06/2026", done: false },
                { icon: Clock, label: "Liberación", date: "—", done: false },
              ].map((e) => (
                <div key={e.label} className="flex items-center gap-3 text-xs">
                  <span
                    className={`flex h-6 w-6 flex-none items-center justify-center rounded-full ${
                      e.done ? "bg-primary-foreground text-primary" : "bg-primary-foreground/15 text-primary-foreground/75"
                    }`}
                  >
                    <e.icon className="h-3 w-3" />
                  </span>
                  <span className={`flex-1 ${e.done ? "text-primary-foreground" : "text-primary-foreground/80"}`}>
                    {e.label}
                  </span>
                  <span className="font-mono text-primary-foreground/70">{e.date}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Prueba social: navieras rastreables + estándares cumplidos */}
      <div className="relative border-t border-primary-foreground/10 bg-primary/95">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
          <p className="mb-5 text-center text-xs font-medium uppercase tracking-wider text-primary-foreground/75">
            {PROOF_TITLE}
          </p>

          <div className="space-y-4">
            <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-6">
              <span className="text-2xs font-semibold uppercase tracking-wider text-primary-foreground/55 sm:w-40 sm:shrink-0 sm:text-right">
                Navieras que rastreamos
              </span>
              <div className="flex flex-1 flex-wrap items-center gap-x-6 gap-y-2">
                {PROOF_NAVIERAS.map((l) => (
                  <span key={l} className="text-sm font-semibold tracking-tight text-primary-foreground/70">
                    {l}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-6">
              <span className="text-2xs font-semibold uppercase tracking-wider text-primary-foreground/55 sm:w-40 sm:shrink-0 sm:text-right">
                Estándares que cumplimos
              </span>
              <div className="flex flex-1 flex-wrap items-center gap-x-6 gap-y-2">
                {PROOF_ESTANDARES.map((l) => (
                  <span key={l} className="text-sm font-semibold tracking-tight text-primary-foreground/70">
                    {l}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <p className="mt-5 text-center text-2xs text-primary-foreground/50">
            {PROOF_DISCLAIMER}
          </p>
        </div>
      </div>
    </section>
  );
}
