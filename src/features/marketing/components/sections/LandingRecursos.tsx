import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { BookOpen, ArrowRight } from "lucide-react";

const RECURSOS = [
  {
    id: "carta-porte",
    title: "Guía Carta Porte 3.0",
    desc: "Todo lo que necesitas saber sobre la Carta Porte en México: obligaciones, figuras, tipos de transporte y sanciones.",
    to: "/recursos/guia-carta-porte-3",
    tag: "Normativa",
  },
  {
    id: "incoterms",
    title: "Guía Incoterms 2020",
    desc: "Explicación práctica de los 11 Incoterms 2020 con ejemplos de uso en importaciones y exportaciones.",
    to: "/recursos/guia-incoterms-2020",
    tag: "Comercio exterior",
  },
  {
    id: "puertos",
    title: "Guía de puertos de México",
    desc: "Los principales puertos mexicanos con su código UN/LOCODE, conexiones y usos típicos por tipo de carga.",
    to: "/recursos/guia-puertos-mexico",
    tag: "Operación",
  },
] as const;


export function LandingRecursos() {
  return (
    <section
      id="recursos"
      aria-labelledby="recursos-title"
      className="bg-muted/40 py-24 sm:py-32"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-accent">
            Aprende
          </p>
          <h2
            id="recursos-title"
            className="text-balance text-4xl font-bold tracking-tight text-foreground sm:text-5xl"
          >
            Recursos para forwarders
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Guías prácticas escritas por operadores mexicanos, para operadores mexicanos.
          </p>
        </div>

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {RECURSOS.map((r) => (
            <Card
              key={r.id}
              className="group relative overflow-hidden p-8 transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-overlay"
            >
              <div
                aria-hidden="true"
                className="absolute -right-16 -top-16 h-44 w-44 rounded-full bg-accent/[0.07] blur-2xl transition-opacity group-hover:opacity-100"
              />
              <div className="relative">
                <div className="mb-4 flex items-center gap-3">
                  <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10 text-accent transition-colors group-hover:bg-accent group-hover:text-accent-foreground">
                    <BookOpen className="h-6 w-6" />
                  </div>
                  <span className="rounded-full border border-border bg-muted/60 px-3 py-1 text-xs font-medium text-muted-foreground">
                    {r.tag}
                  </span>
                </div>
                <h3 className="mb-2 text-2xl font-semibold tracking-tight text-foreground">
                  {r.title}
                </h3>
                <p className="mb-6 text-base leading-relaxed text-muted-foreground">
                  {r.desc}
                </p>
                <Link
                  to={r.to}
                  className="inline-flex items-center gap-2 text-sm font-semibold text-accent transition-colors hover:text-accent/80"
                >
                  Leer guía <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
