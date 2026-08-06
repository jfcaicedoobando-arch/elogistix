import { useState, useMemo } from "react";
import { Search, HelpCircle, BookOpen } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { EmptyStateInline } from "@/components/empty/EmptyStateInline";
import { GLOSARIO, MODULOS } from "./ayudaContent";
import { PageContainer } from "@/components/shared/PageContainer";

/**
 * Página /ayuda — onboarding y referencia rápida para el usuario final.
 * Contenido en src/features/dashboard/routes/ayudaContent.ts.
 * v13.118.1 — Glosario expandido y 12 módulos por rol con índice clickeable.
 */
export default function Ayuda() {
  const [search, setSearch] = useState("");

  const glosarioFiltrado = useMemo(() => {
    if (!search) return GLOSARIO;
    const s = search.toLowerCase();
    return GLOSARIO.filter(
      (g) => g.termino.toLowerCase().includes(s) || g.definicion.toLowerCase().includes(s),
    );
  }, [search]);

  const modulosFiltrados = useMemo(() => {
    if (!search) return MODULOS;
    const s = search.toLowerCase();
    return MODULOS
      .map((m) => ({
        ...m,
        faqs: m.faqs.filter(
          (f) => f.pregunta.toLowerCase().includes(s) || f.respuesta.toLowerCase().includes(s),
        ),
      }))
      .filter((m) => m.faqs.length > 0);
  }, [search]);

  return (
    <PageContainer><div className="max-w-5xl mx-auto space-y-4 sm:space-y-6">
      <PageHeader
        title="Centro de ayuda"
        description="Glosario, preguntas frecuentes y guías rápidas para usar el ERP en operación diaria."
      />

      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar término, pregunta o concepto..."
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="faq">
        <TabsList>
          <TabsTrigger value="faq">
            <HelpCircle className="h-4 w-4 mr-2" /> Preguntas frecuentes
          </TabsTrigger>
          <TabsTrigger value="glosario">
            <BookOpen className="h-4 w-4 mr-2" /> Glosario
          </TabsTrigger>
        </TabsList>

        <TabsContent value="faq" className="space-y-4">
          {!search && (
            <Card>
              <CardContent className="p-4">
                <p className="text-overline font-semibold mb-2">
                  Ir a una sección
                </p>
                <div className="flex flex-wrap gap-2">
                  {MODULOS.map((m) => (
                    <a
                      key={m.id}
                      href={`#${m.id}`}
                      className="inline-flex items-center px-3 py-1 text-xs rounded-md border border-border bg-muted/50 hover:bg-muted text-foreground transition-colors"
                    >
                      {m.titulo}
                    </a>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {modulosFiltrados.length === 0 ? (
            <Card>
              <CardContent className="p-6">
                <EmptyStateInline icon={HelpCircle} message={`No hay resultados para "${search}".`} />
              </CardContent>
            </Card>
          ) : (
            modulosFiltrados.map((modulo) => (
              <Card key={modulo.id} id={modulo.id} className="scroll-mt-20">
                <CardHeader>
                  <CardTitle className="flex items-start justify-between gap-3">
                    <div className="flex flex-col gap-1 min-w-0">
                      <span>{modulo.titulo}</span>
                      {modulo.audiencia && modulo.audiencia.length > 0 && (
                        <span className="text-label font-normal text-muted-foreground">
                          Para: {modulo.audiencia.join(" · ")}
                        </span>
                      )}
                    </div>
                    <Badge variant="secondary" className="shrink-0">{modulo.faqs.length}</Badge>
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">{modulo.resumen}</p>
                </CardHeader>
                <CardContent>
                  <Accordion type="single" collapsible className="w-full">
                    {modulo.faqs.map((faq, idx) => (
                      <AccordionItem key={idx} value={`${modulo.id}-${idx}`}>
                        <AccordionTrigger className="text-left text-sm font-medium">
                          {faq.pregunta}
                        </AccordionTrigger>
                        <AccordionContent className="text-sm text-muted-foreground">
                          {faq.respuesta}
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="glosario">
          <Card>
            <CardHeader>
              <CardTitle>Glosario de términos del forwarder</CardTitle>
              <p className="text-sm text-muted-foreground">
                {glosarioFiltrado.length} término{glosarioFiltrado.length === 1 ? "" : "s"}
              </p>
            </CardHeader>
            <CardContent>
              {glosarioFiltrado.length === 0 ? (
                <EmptyStateInline icon={BookOpen} message={`No hay términos que coincidan con "${search}".`} />
              ) : (
                <dl className="space-y-4">
                  {glosarioFiltrado.map((g) => (
                    <div key={g.termino} className="border-b border-border last:border-0 pb-3 last:pb-0">
                      <dt className="font-semibold text-sm text-foreground">{g.termino}</dt>
                      <dd className="text-sm text-muted-foreground mt-1">{g.definicion}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle>¿No encuentras lo que buscas?</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            Usa el botón flotante de <strong>Feedback</strong> (esquina inferior) para reportar un problema
            o sugerir mejora; el equipo lo recibe con captura de pantalla y contexto automático.
          </p>
          <p>
            El registro completo de cambios y funciones nuevas vive en <code>CHANGELOG.md</code>.
            Si eres administrador de la organización, también puedes consultar <strong>/auditoria</strong>{" "}
            para ver el estado técnico del sistema.
          </p>
        </CardContent>
      </Card>
    </div></PageContainer>
  );
}
