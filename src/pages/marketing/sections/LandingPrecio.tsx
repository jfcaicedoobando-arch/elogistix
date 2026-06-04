import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Check, ArrowRight } from "lucide-react";
import { PRECIO } from "../landingCopy";

export function LandingPrecio() {
  return (
    <section id="precio" className="bg-muted/40 py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-accent">
            Precio
          </p>
          <h2 className="text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Una sola tarifa: cero
          </h2>
        </div>

        <div className="mx-auto mt-10 max-w-xl">
          <div className="overflow-hidden rounded-2xl border border-accent/30 bg-card shadow-[var(--shadow-overlay)]">
            <div className="bg-primary px-8 py-3 text-center">
              <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-accent">
                {PRECIO.badge}
              </span>
            </div>
            <div className="p-8 sm:p-10">
              <div className="text-center">
                <p className="text-5xl font-bold tracking-tight text-foreground sm:text-6xl">
                  {PRECIO.price}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">{PRECIO.unit}</p>
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
                <Link to="/login">
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
