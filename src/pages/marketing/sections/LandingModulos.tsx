import { Card } from "@/components/ui/card";
import {
  FileText, Ship, Receipt, Wallet, Users, Target, type LucideIcon,
} from "lucide-react";
import { MODULOS } from "../landingCopy";

const ICONS: Record<string, LucideIcon> = { FileText, Ship, Receipt, Wallet, Users, Target };

export function LandingModulos() {
  return (
    <section id="modulos" className="bg-background py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-accent">
            Todo en uno
          </p>
          <h2 className="text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Seis módulos diseñados para operar una agencia de carga
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Desde la primera cotización hasta el cobro de la última factura. Sin
            cambiar de pestaña, sin pegar datos entre apps.
          </p>
        </div>

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {MODULOS.map((m) => {
            const Icon = ICONS[m.icon] ?? FileText;
            return (
              <Card key={m.title} className="group p-6 transition-all hover:shadow-[var(--shadow-overlay)]">
                <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-accent/10 text-accent transition-colors group-hover:bg-accent group-hover:text-accent-foreground">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mb-2 text-lg font-semibold tracking-tight text-foreground">
                  {m.title}
                </h3>
                <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
                  {m.desc}
                </p>
                <ul className="space-y-1.5">
                  {m.bullets.map((b) => (
                    <li key={b} className="flex items-center gap-2 text-sm text-foreground/80">
                      <span className="h-1 w-1 rounded-full bg-accent" />
                      {b}
                    </li>
                  ))}
                </ul>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}
