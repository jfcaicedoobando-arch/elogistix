import { Card } from "@/components/ui/card";
import {
  FileText, Ship, Receipt, Wallet, Users, Target, type LucideIcon,
} from "lucide-react";
import { MODULOS } from "../landingCopy";

const ICONS: Record<string, LucideIcon> = { FileText, Ship, Receipt, Wallet, Users, Target };

export function LandingModulos() {
  const featured = MODULOS.filter((m) => m.featured);
  const rest = MODULOS.filter((m) => !m.featured);

  return (
    <section
      id="modulos"
      aria-labelledby="modulos-title"
      className="bg-background py-24 sm:py-32"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-accent">
            Todo en uno
          </p>
          <h2
            id="modulos-title"
            className="text-balance text-4xl font-bold tracking-tight text-foreground sm:text-5xl"
          >
            Seis módulos diseñados para operar una agencia de carga
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Desde la primera cotización hasta el cobro de la última factura. Sin
            cambiar de pestaña, sin pegar datos entre apps.
          </p>
        </div>

        {/* Bento: 2 destacados grandes + 4 chicos */}
        <div className="mt-14 grid gap-6 lg:grid-cols-2">
          {featured.map((m) => {
            const Icon = ICONS[m.icon] ?? FileText;
            return (
              <Card
                key={m.title}
                className="group relative overflow-hidden p-8 transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-overlay)]"
              >
                <div
                  aria-hidden="true"
                  className="absolute -right-16 -top-16 h-44 w-44 rounded-full bg-accent/[0.07] blur-2xl transition-opacity group-hover:opacity-100"
                />
                <div className="relative">
                  <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10 text-accent transition-colors group-hover:bg-accent group-hover:text-accent-foreground">
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="mb-2 text-2xl font-semibold tracking-tight text-foreground">
                    {m.title}
                  </h3>
                  <p className="mb-5 text-base leading-relaxed text-muted-foreground">
                    {m.desc}
                  </p>
                  <ul className="space-y-1.5">
                    {m.bullets.map((b) => (
                      <li key={b} className="flex items-center gap-2 text-sm text-foreground/85">
                        <span className="h-1 w-1 rounded-full bg-accent" />
                        {b}
                      </li>
                    ))}
                  </ul>
                </div>
              </Card>
            );
          })}
        </div>

        <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {rest.map((m) => {
            const Icon = ICONS[m.icon] ?? FileText;
            return (
              <Card
                key={m.title}
                className="group p-6 transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-overlay)]"
              >
                <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 text-accent transition-colors group-hover:bg-accent group-hover:text-accent-foreground">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mb-1.5 text-base font-semibold tracking-tight text-foreground">
                  {m.title}
                </h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {m.desc}
                </p>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}
