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
import { GLOSARIO, MODULOS } from "@/content/ayudaContent";

/**
 * Página /ayuda — onboarding y referencia rápida para operadores.
 * Contenido en src/content/ayudaContent.ts (separado para mantener <200 líneas).
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
    <div className="space-y-6 max-w-5xl mx-auto">
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
          {modulosFiltrados.length === 0 ? (
            <Card>
              <CardContent className="p-6">
                <EmptyStateInline icon={HelpCircle} message={`No hay resultados para "${search}".`} />
              </CardContent>
            </Card>
          ) : (
            modulosFiltrados.map((modulo) => (
              <Card key={modulo.id}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between text-base">
                    <span>{modulo.titulo}</span>
                    <Badge variant="secondary">{modulo.faqs.length}</Badge>
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
              <CardTitle className="text-base">Glosario de términos del forwarder</CardTitle>
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
          <CardTitle className="text-base">¿No encuentras lo que buscas?</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            Contacta al administrador de tu organización (sección <strong>Usuarios</strong> del menú lateral)
            o al super-admin del sistema para reportar un problema o sugerir mejoras.
          </p>
          <p>
            El registro completo de cambios y nuevas funcionalidades está en{" "}
            <a href="/changelog" className="text-primary underline">Changelog</a>.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
