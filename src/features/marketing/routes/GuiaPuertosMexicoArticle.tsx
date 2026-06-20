/**
 * Cuerpo del artículo de la guía "Principales puertos marítimos de México".
 * Extraído para mantener la página productiva ≤200 líneas (Power of 10).
 */
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Anchor, MapPin, Ship } from "lucide-react";
import { FAQ, PUERTOS, type PuertoData } from "./guiaPuertosMexico.data";

function PuertoSection({ puerto }: { puerto: PuertoData }) {
  return (
    <section id={puerto.id} className="scroll-mt-20 mt-14">
      <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-accent/10 px-3 py-1 text-sm font-medium text-accent">
        <Anchor className="h-4 w-4" /> UN/LOCODE {puerto.unlocode}
      </div>
      <h2 className="text-3xl font-bold tracking-tight">
        Puerto de {puerto.nombre} ({puerto.unlocode})
      </h2>
      <p className="mt-3 inline-flex items-center gap-2 text-sm text-muted-foreground">
        <MapPin className="h-4 w-4 text-accent" />
        {puerto.ubicacion} · Costa del {puerto.costa}
      </p>
      <p className="mt-4 text-base leading-relaxed text-muted-foreground">
        {puerto.destacado}
      </p>
      <dl className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-background p-4">
          <dt className="text-xs font-semibold uppercase tracking-wider text-accent">
            Rutas principales
          </dt>
          <dd className="mt-1 text-sm text-foreground">{puerto.rutasPrincipales}</dd>
        </div>
        <div className="rounded-xl border border-border bg-background p-4">
          <dt className="text-xs font-semibold uppercase tracking-wider text-accent">
            Tipo de carga
          </dt>
          <dd className="mt-1 text-sm text-foreground">{puerto.carga}</dd>
        </div>
        <div className="rounded-xl border border-border bg-background p-4 sm:col-span-2">
          <dt className="text-xs font-semibold uppercase tracking-wider text-accent">
            Navieras presentes
          </dt>
          <dd className="mt-1 text-sm text-foreground">{puerto.navieras}</dd>
        </div>
      </dl>
    </section>
  );
}

export function GuiaPuertosMexicoArticle() {
  return (
    <>
      <section id="resumen" className="scroll-mt-20">
        <h2 className="text-3xl font-bold tracking-tight">
          Los 5 puertos más importantes de México
        </h2>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground">
          México opera <strong>117 puertos y terminales habilitadas</strong>, pero
          el grueso del comercio marítimo se concentra en cinco: dos en el Golfo
          de México (<strong>Veracruz</strong> y <strong>Altamira</strong>) y tres
          en el Pacífico (<strong>Manzanillo</strong>,{" "}
          <strong>Lázaro Cárdenas</strong> y <strong>Ensenada</strong>). En
          conjunto manejan más del <strong>90% de los TEUs</strong> que entran y
          salen del país.
        </p>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground">
          Para un freight forwarder mexicano, elegir bien el puerto define el
          tiempo de tránsito, el costo de drayage interior y la disponibilidad de
          servicios marítimos directos. Esta guía resume cada uno con su{" "}
          <strong>UN/LOCODE</strong>, rutas troncales, tipo de carga y navieras
          presentes.
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {PUERTOS.map((p) => (
            <a
              key={p.id}
              href={`#${p.id}`}
              className="group rounded-xl border border-border bg-background p-4 transition hover:border-accent"
            >
              <Ship className="h-5 w-5 text-accent" />
              <p className="mt-2 font-semibold text-foreground group-hover:text-accent">
                {p.nombre}
              </p>
              <p className="text-xs text-muted-foreground">
                {p.unlocode} · {p.costa}
              </p>
            </a>
          ))}
        </div>
      </section>

      {PUERTOS.map((p) => (
        <PuertoSection key={p.id} puerto={p} />
      ))}

      <section id="comparativo" className="scroll-mt-20 mt-14">
        <h2 className="text-3xl font-bold tracking-tight">Tabla comparativa</h2>
        <p className="mt-3 text-base leading-relaxed text-muted-foreground">
          Resumen de los cinco principales puertos mexicanos por costa y vocación
          de carga:
        </p>
        <div className="mt-6 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left">
                <th className="px-3 py-2 font-semibold">Puerto</th>
                <th className="px-3 py-2 font-semibold">UN/LOCODE</th>
                <th className="px-3 py-2 font-semibold">Costa</th>
                <th className="px-3 py-2 font-semibold">Vocación</th>
              </tr>
            </thead>
            <tbody>
              {PUERTOS.map((p) => (
                <tr key={p.id} className="border-b border-border/60">
                  <td className="px-3 py-2 font-medium text-foreground">{p.nombre}</td>
                  <td className="px-3 py-2 font-mono text-xs">{p.unlocode}</td>
                  <td className="px-3 py-2 text-muted-foreground">{p.costa}</td>
                  <td className="px-3 py-2 text-muted-foreground">{p.carga}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section id="faq" className="scroll-mt-20 mt-14">
        <h2 className="text-3xl font-bold tracking-tight">Preguntas frecuentes</h2>
        <Accordion type="single" collapsible className="mt-6">
          {FAQ.map((f, i) => (
            <AccordionItem key={f.q} value={`item-${i}`}>
              <AccordionTrigger className="text-left text-base font-semibold">
                {f.q}
              </AccordionTrigger>
              <AccordionContent className="text-base leading-relaxed text-muted-foreground">
                {f.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>
    </>
  );
}
