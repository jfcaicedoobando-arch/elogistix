import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle2, Ship, Plane, Truck } from "lucide-react";
import { HERO, PROOF, KPIS } from "../landingCopy";

export function LandingHero() {
  return (
    <section className="relative overflow-hidden bg-primary text-primary-foreground">
      {/* Decoración */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-40"
      >
        <div className="absolute -left-32 -top-32 h-80 w-80 rounded-full bg-accent/30 blur-3xl" />
        <div className="absolute right-[-10%] bottom-[-20%] h-96 w-96 rounded-full bg-[hsl(199_89%_48%/0.25)] blur-3xl" />
      </div>

      <div className="relative mx-auto grid max-w-6xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:py-28">
        <div className="flex flex-col justify-center">
          <span className="mb-5 inline-flex w-fit items-center gap-2 rounded-full border border-primary-foreground/20 bg-primary-foreground/10 px-3 py-1 text-xs font-medium uppercase tracking-wider text-primary-foreground/90">
            {HERO.eyebrow}
          </span>
          <h1 className="text-balance text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">
            {HERO.h1}
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-primary-foreground/80">
            {HERO.sub}
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90">
              <Link to="/login">
                {HERO.primaryCta} <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
            >
              <Link to="/login">{HERO.secondaryCta}</Link>
            </Button>
          </div>

          <p className="mt-5 flex items-center gap-2 text-sm text-primary-foreground/70">
            <CheckCircle2 className="h-4 w-4 text-accent" />
            Sin tarjeta de crédito. Usuarios ilimitados.
          </p>
        </div>

        {/* Mockup decorativo del dashboard */}
        <div className="relative flex items-center justify-center">
          <div className="w-full max-w-md rounded-2xl border border-primary-foreground/10 bg-primary-foreground/5 p-5 shadow-2xl backdrop-blur-sm">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-primary-foreground/70">
                Dashboard
              </span>
              <span className="flex gap-1">
                <span className="h-2 w-2 rounded-full bg-[hsl(160_84%_39%)]" />
                <span className="h-2 w-2 rounded-full bg-[hsl(38_92%_50%)]" />
                <span className="h-2 w-2 rounded-full bg-[hsl(199_89%_48%)]" />
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Embarques activos", value: "42", icon: Ship },
                { label: "ETA esta semana", value: "11", icon: Plane },
                { label: "CxC vencido", value: "$184K", icon: Truck },
                { label: "Margen mes", value: "23.4%", icon: CheckCircle2 },
              ].map((kpi) => (
                <div
                  key={kpi.label}
                  className="rounded-xl bg-primary-foreground/10 p-4"
                >
                  <kpi.icon className="mb-2 h-4 w-4 text-accent" />
                  <p className="text-xs text-primary-foreground/70">{kpi.label}</p>
                  <p className="text-xl font-bold">{kpi.value}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 space-y-2">
              {[
                { folio: "LCG-2026-0142", estado: "En tránsito", w: "70%" },
                { folio: "LCG-2026-0141", estado: "En puerto", w: "45%" },
                { folio: "LCG-2026-0139", estado: "Liberado", w: "100%" },
              ].map((row) => (
                <div key={row.folio} className="rounded-lg bg-primary-foreground/5 p-3 text-xs">
                  <div className="mb-1 flex justify-between">
                    <span className="font-mono font-semibold">{row.folio}</span>
                    <span className="text-primary-foreground/70">{row.estado}</span>
                  </div>
                  <div className="h-1 overflow-hidden rounded-full bg-primary-foreground/10">
                    <div className="h-full rounded-full bg-accent" data-w={row.w} style={{ width: row.w }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* KPIs strip */}
      <div className="relative border-t border-primary-foreground/10 bg-primary/95">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
          <p className="mb-4 text-center text-sm text-primary-foreground/70">{PROOF}</p>
          <div className="grid grid-cols-3 gap-4 text-center">
            {KPIS.map((k) => (
              <div key={k.label}>
                <p className="text-2xl font-bold text-accent sm:text-3xl">{k.value}</p>
                <p className="text-xs text-primary-foreground/70 sm:text-sm">{k.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
