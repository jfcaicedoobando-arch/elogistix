import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Check, ArrowRight, Sparkles } from "lucide-react";
import { PRECIO } from "../landingCopy";

export function LandingPrecio() {
  return (
    <section
      id="precio"
      aria-labelledby="precio-title"
      className="bg-muted/40 py-24 sm:py-32"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-accent">
            Precio
          </p>
          <h2
            id="precio-title"
            className="text-balance text-4xl font-bold tracking-tight text-foreground sm:text-5xl"
          >
            {PRECIO.title}
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">{PRECIO.subtitle}</p>
        </div>

        <div className="relative mx-auto mt-12 max-w-xl">
          {/* Halo sutil */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -inset-4 -z-10 rounded-3xl bg-accent/10 opacity-60 blur-2xl"
          />
          <div className="overflow-hidden rounded-2xl border border-accent/40 bg-card shadow-[var(--shadow-overlay)]">
            <div className="flex items-center justify-center gap-2 bg-primary px-8 py-3 text-center">
              <Sparkles className="h-4 w-4 text-accent" />
              <span className="text-xs font-semibold uppercase tracking-wider text-accent">
                {PRECIO.badge}
              </span>
            </div>
            <div className="p-8 sm:p-10">
              <div className="text-center">
                <p className="flex items-baseline justify-center gap-2">
                  <span className="text-6xl font-bold tracking-tight text-foreground sm:text-7xl">
                    {PRECIO.price}
                  </span>
                  <span className="text-sm font-medium text-muted-foreground">{PRECIO.unit}</span>
                </p>
              </div>

              <ul className="mt-8 space-y-3">
                {PRECIO.bullets.map((b) => (
                  <li key={b} className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full bg-accent text-accent-foreground">
                      <Check className="h-3 w-3" />
                    </span>
                    <span className="text-foreground/85">{b}</span>
                  </li>
                ))}
              </ul>

              <Button asChild size="lg" className="mt-8 w-full">
                <Link to="/login?tab=signup">
                  Crear cuenta gratis <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>

              <p className="mt-5 text-center text-xs leading-relaxed text-muted-foreground">
                {PRECIO.note}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
