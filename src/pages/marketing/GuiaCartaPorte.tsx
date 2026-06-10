/**
 * Guía Carta Porte 3.0 — página de contenido SEO orientada a México.
 * Captura búsqueda orgánica sobre el complemento Carta Porte del SAT.
 */
import { Link } from "react-router-dom";
import { Seo } from "@/components/seo/Seo";
import { LandingNav } from "./sections/LandingNav";
import { LandingFooter } from "./sections/LandingFooter";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle2, FileText, Truck, Ship, Plane } from "lucide-react";

const PUBLISHED_AT = "2026-06-10";
const URL = "https://librecarga.com/recursos/guia-carta-porte-3";

const FAQ = [
  {
    q: "¿Qué es el complemento Carta Porte 3.0?",
    a: "Es el complemento del CFDI que el SAT exige para amparar el traslado legal de mercancías en territorio nacional por vía terrestre (autotransporte federal), marítima, aérea o ferroviaria. La versión 3.0 (vigente desde el 17 de julio de 2024) sustituye a la 2.0 y agrega validaciones más estrictas sobre claves de producto, ubicaciones, peso y datos del transportista.",
  },
  {
    q: "¿Quién está obligado a emitir Carta Porte en México?",
    a: "Cualquier persona física o moral que traslade mercancías por territorio nacional: transportistas (CFDI tipo Ingreso + complemento) y propietarios/intermediarios que mueven bienes propios (CFDI tipo Traslado + complemento). Aplica a autotransporte federal, marítimo, aéreo y ferroviario.",
  },
  {
    q: "¿Cuándo entró en vigor la versión 3.0?",
    a: "El SAT publicó la versión 3.0 el 17 de julio de 2024. El periodo de convivencia con la 2.0 terminó y desde entonces todos los CFDI con complemento Carta Porte deben emitirse en versión 3.0.",
  },
  {
    q: "¿Qué multas hay por no emitir Carta Porte o emitirla con errores?",
    a: "El CFF prevé multas de $760 a $14,710 MXN por cada CFDI emitido con errores u omisiones en el complemento, además de la posible inmovilización de la mercancía en revisiones de la Guardia Nacional o el SAT. Reincidencia y dolo agravan la sanción.",
  },
  {
    q: "¿Necesito Carta Porte para tramos internacionales (importación/exportación)?",
    a: "Sí, para el tramo nacional. En importaciones marítimas o aéreas, el complemento ampara el traslado desde el puerto/aeropuerto de entrada hasta el destino final en México. En exportaciones, ampara desde el origen hasta el punto de salida del país. El tramo internacional puro se ampara con el BL, AWB o documento equivalente.",
  },
  {
    q: "¿Cómo se llenan los campos de ubicación origen y destino?",
    a: "Cada ubicación requiere RFC del remitente/destinatario, código postal (de la matriz del SAT), fecha y hora estimada de salida o llegada, y distancia recorrida (en el caso de autotransporte). Para extranjero se usa el RFC genérico XEXX010101000 o XAXX010101000 según corresponda.",
  },
  {
    q: "¿Qué claves del catálogo del SAT son críticas?",
    a: "ClaveProdServCP (catálogo c_ClaveProdServCP), ClaveUnidad (c_ClaveUnidad), TipoEmbalaje (c_TipoEmbalaje), Material Peligroso y clave SCT cuando aplique. Una clave equivocada es la causa #1 de rechazo del CFDI por el PAC.",
  },
  {
    q: "¿Libre Carga genera Carta Porte 3.0?",
    a: "Libre Carga centraliza tus embarques, contenedores, bultos, rutas y datos de clientes para que tu PAC o ERP contable timbre el CFDI con complemento Carta Porte 3.0 sin re-capturar información. El timbrado se realiza con tu PAC autorizado (Libre Carga no es PAC).",
  },
];

const SECCIONES = [
  { id: "que-es", titulo: "¿Qué es el complemento Carta Porte 3.0?" },
  { id: "obligados", titulo: "¿Quién está obligado a emitirlo?" },
  { id: "tipos", titulo: "Tipos de CFDI: Ingreso vs Traslado" },
  { id: "modos", titulo: "Carta Porte por modo de transporte" },
  { id: "campos", titulo: "Campos obligatorios y catálogos del SAT" },
  { id: "errores", titulo: "Errores más comunes y cómo evitarlos" },
  { id: "multas", titulo: "Multas y sanciones" },
  { id: "checklist", titulo: "Checklist antes de timbrar" },
  { id: "faq", titulo: "Preguntas frecuentes" },
];

const FAQ_JSONLD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};

const ARTICLE_JSONLD = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "Guía Carta Porte 3.0 México: complemento CFDI 2026",
  description:
    "Guía completa del complemento Carta Porte 3.0 del SAT: obligados, tipos de CFDI, modos de transporte, campos, multas y checklist.",
  datePublished: PUBLISHED_AT,
  dateModified: PUBLISHED_AT,
  inLanguage: "es-MX",
  author: { "@type": "Organization", name: "Libre Carga" },
  publisher: {
    "@type": "Organization",
    name: "Libre Carga",
    logo: {
      "@type": "ImageObject",
      url: "https://librecarga.com/librecarga-logo.png",
    },
  },
  mainEntityOfPage: { "@type": "WebPage", "@id": URL },
};

const BREADCRUMB_JSONLD = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Inicio", item: "https://librecarga.com/" },
    { "@type": "ListItem", position: 2, name: "Recursos", item: "https://librecarga.com/recursos" },
    { "@type": "ListItem", position: 3, name: "Guía Carta Porte 3.0", item: URL },
  ],
};

export default function GuiaCartaPorte() {
  return (
    <div className="landing-scope min-h-screen bg-background text-foreground">
      <Seo
        title="Guía Carta Porte 3.0 México (2026): CFDI, obligados y multas"
        description="Guía práctica del complemento Carta Porte 3.0 del SAT: quién está obligado, tipos de CFDI, campos clave, multas y checklist para forwarders mexicanos."
        canonical={URL}
        ogTitle="Guía Carta Porte 3.0 México (2026): todo lo que debes saber"
        ogDescription="Complemento CFDI Carta Porte 3.0: obligados, modos de transporte, campos del SAT, multas y checklist."
        ogUrl={URL}
        jsonLd={[FAQ_JSONLD, ARTICLE_JSONLD, BREADCRUMB_JSONLD]}
      />
      <LandingNav />

      <main>
        {/* Hero */}
        <header className="border-b border-border bg-muted/30 py-16 sm:py-20">
          <div className="mx-auto max-w-3xl px-4 sm:px-6">
            <nav aria-label="Migas de pan" className="mb-4 text-sm text-muted-foreground">
              <Link to="/" className="hover:text-foreground">Inicio</Link>
              <span className="mx-2">/</span>
              <span>Recursos</span>
              <span className="mx-2">/</span>
              <span className="text-foreground">Guía Carta Porte 3.0</span>
            </nav>
            <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-accent/10 px-3 py-1 text-sm font-medium text-accent">
              <FileText className="h-4 w-4" /> Guía SAT · México 🇲🇽
            </p>
            <h1 className="text-balance text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
              Guía Carta Porte 3.0: complemento CFDI 2026 para México
            </h1>
            <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
              Todo lo que un agente de carga, transportista o exportador mexicano
              necesita saber sobre el complemento <strong>Carta Porte 3.0</strong>{" "}
              del SAT: quién está obligado, qué CFDI emitir, qué campos son críticos,
              qué multas aplican y cómo evitar rechazos del PAC.
            </p>
            <p className="mt-3 text-sm text-muted-foreground">
              Actualizado: 10 de junio de 2026 · Lectura: 8 min
            </p>
          </div>
        </header>

        {/* Índice */}
        <section aria-labelledby="indice" className="border-b border-border bg-background py-10">
          <div className="mx-auto max-w-3xl px-4 sm:px-6">
            <h2 id="indice" className="mb-4 text-sm font-semibold uppercase tracking-wider text-accent">
              Contenido de esta guía
            </h2>
            <ol className="grid gap-2 sm:grid-cols-2">
              {SECCIONES.map((s, i) => (
                <li key={s.id}>
                  <a
                    href={`#${s.id}`}
                    className="flex gap-2 text-sm text-muted-foreground hover:text-foreground"
                  >
                    <span className="font-mono text-xs text-accent">{String(i + 1).padStart(2, "0")}</span>
                    {s.titulo}
                  </a>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Cuerpo */}
        <article className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-20">
          <section id="que-es" className="scroll-mt-20">
            <h2 className="text-3xl font-bold tracking-tight">¿Qué es el complemento Carta Porte 3.0?</h2>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">
              El <strong>complemento Carta Porte</strong> es un anexo obligatorio del
              CFDI (Comprobante Fiscal Digital por Internet) que ampara el traslado
              legal de mercancías dentro de México. Lo emite quien transporta los
              bienes o quien los mueve por cuenta propia, y lo exige el SAT con
              fundamento en los artículos 29 y 29-A del Código Fiscal de la Federación.
            </p>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">
              La <strong>versión 3.0</strong> entró en vigor el{" "}
              <strong>17 de julio de 2024</strong> y reemplazó a la 2.0. Refuerza
              validaciones sobre claves del catálogo SAT, datos de ubicaciones,
              peso, mercancías peligrosas y figura del transportista.
            </p>
          </section>

          <section id="obligados" className="mt-12 scroll-mt-20">
            <h2 className="text-3xl font-bold tracking-tight">¿Quién está obligado a emitirlo?</h2>
            <ul className="mt-4 space-y-3 text-base leading-relaxed text-muted-foreground">
              <li className="flex gap-3">
                <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-accent" />
                <span><strong>Transportistas</strong> (autotransporte federal, marítimo, aéreo o ferroviario) que prestan el servicio de traslado a terceros.</span>
              </li>
              <li className="flex gap-3">
                <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-accent" />
                <span><strong>Propietarios de la mercancía</strong> que la trasladan con medios propios (flota interna).</span>
              </li>
              <li className="flex gap-3">
                <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-accent" />
                <span><strong>Intermediarios y agentes de carga</strong> que coordinan el traslado por cuenta y orden de un tercero.</span>
              </li>
            </ul>
          </section>

          <section id="tipos" className="mt-12 scroll-mt-20">
            <h2 className="text-3xl font-bold tracking-tight">Tipos de CFDI: Ingreso vs Traslado</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-border bg-muted/30 p-5">
                <h3 className="text-base font-semibold">CFDI de Ingreso</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Lo emite el transportista que cobra por el servicio de traslado.
                  Acredita el ingreso por el flete y al mismo tiempo ampara la
                  legal estancia de la mercancía.
                </p>
              </div>
              <div className="rounded-xl border border-border bg-muted/30 p-5">
                <h3 className="text-base font-semibold">CFDI de Traslado</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Lo emite el dueño de la mercancía cuando la mueve con flota
                  propia o cuando contrata un transportista que no factura el
                  flete por separado. No registra ingreso.
                </p>
              </div>
            </div>
          </section>

          <section id="modos" className="mt-12 scroll-mt-20">
            <h2 className="text-3xl font-bold tracking-tight">Carta Porte por modo de transporte</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <ModoCard icon={Truck} titulo="Autotransporte" desc="Caja, plataforma, torton, full. Requiere placa, configuración vehicular, permiso SCT, datos del operador y seguro." />
                <ModoCard icon={Ship} titulo="Marítimo" desc="BL Master/House, tipo de embarcación, contenedores, puerto de origen/destino y datos del agente naviero." />
              <ModoCard icon={Plane} titulo="Aéreo" desc="AWB, código IATA, aeropuerto origen/destino, aeronave, número de vuelo y datos del agente IATA." />
            </div>
          </section>

          <section id="campos" className="mt-12 scroll-mt-20">
            <h2 className="text-3xl font-bold tracking-tight">Campos obligatorios y catálogos del SAT</h2>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">
              El complemento se alimenta de varios catálogos publicados por el SAT.
              Una sola clave equivocada provoca el rechazo del CFDI por el PAC.
              Los más usados son:
            </p>
            <ul className="mt-4 space-y-2 text-base text-muted-foreground">
              <li>• <code className="rounded bg-muted px-1.5 py-0.5 text-sm">c_ClaveProdServCP</code> — clave de producto/servicio para Carta Porte.</li>
              <li>• <code className="rounded bg-muted px-1.5 py-0.5 text-sm">c_ClaveUnidad</code> — unidad de medida (KGM, PCE, etc.).</li>
              <li>• <code className="rounded bg-muted px-1.5 py-0.5 text-sm">c_TipoEmbalaje</code> — caja, tarima, contenedor, bidón, etc.</li>
              <li>• <code className="rounded bg-muted px-1.5 py-0.5 text-sm">c_MaterialPeligroso</code> — obligatorio si aplica.</li>
              <li>• <code className="rounded bg-muted px-1.5 py-0.5 text-sm">c_CodigoPostal</code> — del origen y destino (matriz del SAT).</li>
              <li>• <code className="rounded bg-muted px-1.5 py-0.5 text-sm">c_ConfigAutotransporte</code> — sólo terrestre.</li>
            </ul>
          </section>

          <section id="errores" className="mt-12 scroll-mt-20">
            <h2 className="text-3xl font-bold tracking-tight">Errores más comunes y cómo evitarlos</h2>
            <ol className="mt-4 list-decimal space-y-3 pl-5 text-base leading-relaxed text-muted-foreground">
              <li><strong>Clave de producto incorrecta.</strong> Confundir el catálogo general de CFDI con <code>c_ClaveProdServCP</code> es la causa #1 de rechazo.</li>
              <li><strong>Código postal desactualizado.</strong> Si no está en la matriz oficial del SAT, el complemento se rechaza.</li>
              <li><strong>Peso bruto vehicular ausente o en unidades equivocadas.</strong> Debe ir en toneladas con punto decimal.</li>
              <li><strong>Datos del operador faltantes.</strong> RFC, nombre, licencia y residencia fiscal son obligatorios en autotransporte.</li>
              <li><strong>Distancia recorrida en 0.</strong> Para autotransporte cada ubicación intermedia debe declarar kilómetros.</li>
            </ol>
          </section>

          <section id="multas" className="mt-12 scroll-mt-20">
            <h2 className="text-3xl font-bold tracking-tight">Multas y sanciones</h2>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">
              El artículo 84 del Código Fiscal de la Federación establece multas
              de <strong>$760 a $14,710 MXN</strong> por cada CFDI con errores u
              omisiones en el complemento. Además, durante revisiones en carretera
              la Guardia Nacional puede inmovilizar la unidad y la mercancía hasta
              que se acredite la legal estancia.
            </p>
          </section>

          <section id="checklist" className="mt-12 scroll-mt-20">
            <h2 className="text-3xl font-bold tracking-tight">Checklist antes de timbrar</h2>
            <ul className="mt-4 space-y-2 text-base text-muted-foreground">
              {[
                "RFC válido de remitente y destinatario (o genérico extranjero).",
                "Códigos postales validados contra la matriz del SAT.",
                "Claves c_ClaveProdServCP y c_ClaveUnidad correctas por mercancía.",
                "Peso bruto vehicular y peso de la carga en kilogramos / toneladas.",
                "Distancia recorrida declarada en cada ubicación (autotransporte).",
                "Datos del operador, placa y configuración vehicular completos.",
                "Material peligroso marcado y con número ONU cuando aplique.",
                "Fecha y hora estimadas de salida y llegada coherentes.",
              ].map((item) => (
                <li key={item} className="flex gap-3">
                  <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-accent" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          <section id="faq" className="mt-16 scroll-mt-20">
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

          {/* CTA */}
          <aside className="mt-16 rounded-2xl border border-border bg-muted/40 p-8 text-center">
            <h2 className="text-2xl font-bold tracking-tight">
              Centraliza tus embarques y olvídate de recapturar datos
            </h2>
            <p className="mt-3 text-base text-muted-foreground">
              Libre Carga concentra rutas, contenedores, bultos y clientes para que tu
              PAC timbre el complemento Carta Porte 3.0 sin errores.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Button asChild size="lg">
                <Link to="/login?tab=signup">
                  Crear cuenta gratis <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/">Ver la plataforma</Link>
              </Button>
            </div>
          </aside>
        </article>
      </main>

      <LandingFooter />
    </div>
  );
}

function ModoCard({
  icon: Icon,
  titulo,
  desc,
}: {
  icon: typeof Truck;
  titulo: string;
  desc: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-background p-5">
      <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-accent/10 text-accent">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="text-base font-semibold">{titulo}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{desc}</p>
    </div>
  );
}
