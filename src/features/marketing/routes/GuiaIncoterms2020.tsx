/**
 * Guía Incoterms 2020 — página de contenido SEO orientada a México.
 * Objetivo: capturar búsquedas "incoterms 2020" (~2,400/mo, KDI 21).
 */
import { Link } from "react-router-dom";
import { Seo } from "@/components/shared/Seo";
import { LandingNav } from "../components/sections/LandingNav";
import { LandingFooter } from "../components/sections/LandingFooter";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle2, Globe } from "lucide-react";
import { ROUTES } from "@/constants/routes";
import {
  URL,
  INCOTERMS,
  FAQ,
  FAQ_JSONLD,
  ARTICLE_JSONLD,
  BREADCRUMB_JSONLD,
} from "./guiaIncoterms2020.data";

export default function GuiaIncoterms2020() {
  return (
    <div className="landing-scope min-h-screen bg-background text-foreground">
      <Seo
        title="Guía Incoterms 2020 México: las 11 reglas explicadas (2026)"
        description="Guía práctica de los 11 Incoterms 2020 para comercio exterior mexicano: EXW, FCA, FOB, CIF, DAP, DDP y más. Cuándo usar cada uno y cambios vs 2010."
        canonical={URL}
        ogTitle="Guía Incoterms 2020 México: las 11 reglas explicadas"
        ogDescription="EXW, FCA, FOB, CIF, DAP, DDP y todos los Incoterms 2020 aplicados al comercio exterior mexicano."
        ogUrl={URL}
        ogType="article"
        ogImage="https://librecarga.com/og-image.jpg"
        jsonLd={[FAQ_JSONLD, ARTICLE_JSONLD, BREADCRUMB_JSONLD]}
      />
      <LandingNav />

      <main>
        <header className="border-b border-border bg-muted/30 py-16 sm:py-20">
          <div className="mx-auto max-w-3xl px-4 sm:px-6">
            <nav aria-label="Migas de pan" className="mb-4 text-sm text-muted-foreground">
              <Link to={ROUTES.LANDING} className="hover:text-foreground">Inicio</Link>
              <span className="mx-2">/</span>
              <span>Recursos</span>
              <span className="mx-2">/</span>
              <span className="text-foreground">Guía Incoterms 2020</span>
            </nav>
            <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-accent/10 px-3 py-1 text-sm font-medium text-accent">
              <Globe className="h-4 w-4" /> Comercio exterior · México 🇲🇽
            </p>
            <h1 className="text-balance text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
              Guía Incoterms 2020: las 11 reglas aplicadas al comercio exterior mexicano
            </h1>
            <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
              EXW, FCA, FOB, CIF, DAP, DDP y todos los demás explicados con casos
              reales de importación y exportación desde y hacia México. Incluye
              cambios respecto a Incoterms 2010 y recomendaciones por modo de
              transporte.
            </p>
            <p className="mt-3 text-sm text-muted-foreground">
              Actualizado: 10 de junio de 2026 · Lectura: 9 min
            </p>
          </div>
        </header>

        <article className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-20">
          <section id="que-son">
            <h2 className="text-3xl font-bold tracking-tight">¿Qué son los Incoterms 2020?</h2>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">
              Los <strong>Incoterms</strong> (International Commercial Terms) son
              las reglas estandarizadas de la <strong>Cámara de Comercio
              Internacional (ICC)</strong> que definen, en cada operación de
              compraventa internacional, las obligaciones del vendedor y del
              comprador en cuatro dimensiones: <em>transporte, riesgo, seguro y
              aduanas</em>.
            </p>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">
              La versión <strong>2020</strong> entró en vigor el 1 de enero de 2020
              y reemplazó a Incoterms 2010. Incluye <strong>11 reglas</strong>:
              7 multimodales y 4 exclusivamente marítimas.
            </p>
          </section>

          <section id="reglas" className="mt-12">
            <h2 className="text-3xl font-bold tracking-tight">Las 11 reglas Incoterms 2020</h2>
            <div className="mt-6 space-y-4">
              {INCOTERMS.map((i) => (
                <div key={i.code} className="rounded-xl border border-border bg-muted/20 p-5">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="rounded-md bg-accent px-2 py-0.5 font-mono text-sm font-bold text-accent-foreground">
                      {i.code}
                    </span>
                    <h3 className="text-lg font-semibold">{i.name}</h3>
                  </div>
                  <p className="mt-1 text-xs uppercase tracking-wider text-muted-foreground">
                    {i.modo}
                  </p>
                  <p className="mt-3 text-sm text-muted-foreground">
                    <strong className="text-foreground">Riesgo:</strong> {i.riesgo}
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    <strong className="text-foreground">Cuándo usarlo:</strong> {i.uso}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section id="cambios-2010" className="mt-12">
            <h2 className="text-3xl font-bold tracking-tight">Cambios principales respecto a Incoterms 2010</h2>
            <ul className="mt-4 space-y-3 text-base leading-relaxed text-muted-foreground">
              <li className="flex gap-3">
                <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-accent" />
                <span><strong>DAT → DPU.</strong> Se renombró para reflejar que la entrega ocurre <em>descargada</em> en cualquier lugar acordado, no sólo en una terminal.</span>
              </li>
              <li className="flex gap-3">
                <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-accent" />
                <span><strong>CIP</strong> ahora exige seguro con cláusula <strong>A</strong> (todo riesgo) en vez de la mínima cláusula C.</span>
              </li>
              <li className="flex gap-3">
                <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-accent" />
                <span><strong>FCA</strong> permite a las partes acordar que el comprador instruya al transportista emitir un BL con anotación "a bordo", útil para cartas de crédito.</span>
              </li>
              <li className="flex gap-3">
                <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-accent" />
                <span>Se reconoce expresamente el <strong>transporte con medios propios</strong> del vendedor o comprador.</span>
              </li>
            </ul>
          </section>

          <section id="elegir" className="mt-12">
            <h2 className="text-3xl font-bold tracking-tight">Cómo elegir el Incoterm correcto</h2>
            <ol className="mt-4 list-decimal space-y-3 pl-5 text-base leading-relaxed text-muted-foreground">
              <li><strong>Identifica el modo de transporte.</strong> Si hay contenedor o transporte multimodal, evita FOB/CFR/CIF y prefiere FCA/CPT/CIP.</li>
              <li><strong>Define hasta dónde quieres asumir riesgo.</strong> A menor responsabilidad, mejor para el vendedor mexicano sin operación en destino.</li>
              <li><strong>Considera quién despacha aduanas.</strong> DDP obliga al vendedor a pagar IVA e IGI en el país del comprador.</li>
              <li><strong>Verifica el seguro.</strong> Sólo CIF y CIP obligan al vendedor a contratarlo. En el resto, conviene contratar póliza propia.</li>
              <li><strong>Documenta el Incoterm en factura, contrato y pedimento.</strong> Es dato obligatorio para el SAT en el campo "INCOTERM" del pedimento.</li>
            </ol>
          </section>

          <section id="faq" className="mt-16">
            <h2 className="text-3xl font-bold tracking-tight">Preguntas frecuentes</h2>
            <Accordion type="single" collapsible className="mt-6">
              {FAQ.map((f, i) => (
                <AccordionItem key={f.q} value={`faq-${i}`}>
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

          <aside className="mt-16 rounded-2xl border border-border bg-muted/40 p-8 text-center">
            <h2 className="text-2xl font-bold tracking-tight">
              Cotiza embarques con el Incoterm correcto desde el inicio
            </h2>
            <p className="mt-3 text-base text-muted-foreground">
              Libre Carga incluye los 11 Incoterms 2020 en cada cotización y embarque,
              con validaciones por modo de transporte. Gratis para forwarders mexicanos.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Button asChild size="lg">
                <Link to={ROUTES.LOGIN_SIGNUP}>
                  Crear cuenta gratis <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to={ROUTES.RECURSOS_GUIA_CARTA_PORTE}>Ver Guía Carta Porte 3.0</Link>
              </Button>
            </div>
          </aside>
        </article>
      </main>

      <LandingFooter />
    </div>
  );
}
