/**
 * Cuerpo del artículo de la guía Carta Porte 3.0.
 * Extraído para mantener la página productiva ≤200 líneas (Power of 10).
 */
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { CheckCircle2, Truck, Ship, Plane } from "lucide-react";
import { FAQ, CHECKLIST_ITEMS } from "./guiaCartaPorte.data";

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

export function GuiaCartaPorteArticle() {
  return (
    <>
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
          {CHECKLIST_ITEMS.map((item) => (
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
    </>
  );
}
