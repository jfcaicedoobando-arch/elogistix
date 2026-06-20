import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { FAQ } from "../landingCopy";

export function LandingFaq() {
  return (
    <section id="faq" className="bg-background py-20 sm:py-24">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <div className="text-center">
          <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-accent">
            Preguntas frecuentes
          </p>
          <h2 className="text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Lo que nuestros forwarders preguntan más
          </h2>
        </div>

        <Accordion type="single" collapsible className="mt-10">
          {FAQ.map((f, i) => (
            <AccordionItem key={f.q} value={`f-${i}`}>
              <AccordionTrigger className="text-left text-base font-semibold">
                {f.q}
              </AccordionTrigger>
              <AccordionContent className="text-base leading-relaxed text-muted-foreground">
                {f.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
