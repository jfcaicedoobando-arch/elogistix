/**
 * Guía Carta Porte 3.0 — página de contenido SEO orientada a México.
 * Captura búsqueda orgánica sobre el complemento Carta Porte del SAT.
 */
import { Link } from "react-router-dom";
import { Seo } from "@/components/shared/Seo";
import { LandingNav } from "../components/sections/LandingNav";
import { LandingFooter } from "../components/sections/LandingFooter";
import { Button } from "@/components/ui/button";
import { ArrowRight, FileText } from "lucide-react";
import { ROUTES } from "@/constants/routes";
import {
  URL,
  SECCIONES,
  FAQ_JSONLD,
  ARTICLE_JSONLD,
  BREADCRUMB_JSONLD,
} from "./guiaCartaPorte.data";
import { GuiaCartaPorteArticle } from "./GuiaCartaPorteArticle";

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
        ogType="article"
        ogImage="https://librecarga.com/og-image.jpg"
        jsonLd={[FAQ_JSONLD, ARTICLE_JSONLD, BREADCRUMB_JSONLD]}
      />
      <LandingNav />

      <main>
        {/* Hero */}
        <header className="border-b border-border bg-muted/30 py-16 sm:py-20">
          <div className="mx-auto max-w-3xl px-4 sm:px-6">
            <nav aria-label="Migas de pan" className="mb-4 text-sm text-muted-foreground">
              <Link to={ROUTES.LANDING} className="hover:text-foreground">Inicio</Link>
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
          <GuiaCartaPorteArticle />

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
                <Link to={ROUTES.LOGIN_SIGNUP}>
                  Crear cuenta gratis <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to={ROUTES.LANDING}>Ver la plataforma</Link>
              </Button>
            </div>
          </aside>
        </article>
      </main>

      <LandingFooter />
    </div>
  );
}
