/**
 * Guía "Principales puertos marítimos de México" — página de contenido SEO
 * orientada a México. Captura búsqueda orgánica sobre puertos de México,
 * UN/LOCODE, rutas Asia–MX y servicios troncales.
 */
import { Link } from "react-router-dom";
import { Seo } from "@/components/shared/Seo";
import { LandingNav } from "../components/sections/LandingNav";
import { LandingFooter } from "../components/sections/LandingFooter";
import { Button } from "@/components/ui/button";
import { ArrowRight, Anchor } from "lucide-react";
import { ROUTES } from "@/constants/routes";
import {
  URL,
  SECCIONES,
  FAQ_JSONLD,
  ARTICLE_JSONLD,
  BREADCRUMB_JSONLD,
} from "./guiaPuertosMexico.data";
import { GuiaPuertosMexicoArticle } from "./GuiaPuertosMexicoArticle";

export default function GuiaPuertosMexico() {
  return (
    <div className="landing-scope min-h-screen bg-background text-foreground">
      <Seo
        title="Principales puertos de México 2026: guía marítima"
        description="Guía 2026 de los 5 puertos más importantes de México: Manzanillo, Veracruz, Lázaro Cárdenas, Altamira y Ensenada. Códigos UN/LOCODE, rutas, navieras y tipo de carga."
        canonical={URL}
        ogTitle="Principales puertos marítimos de México: guía 2026"
        ogDescription="Los 5 puertos top de México con UN/LOCODE, rutas troncales, navieras presentes y tipo de carga."
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
              <span className="text-foreground">Puertos de México</span>
            </nav>
            <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-accent/10 px-3 py-1 text-sm font-medium text-accent">
              <Anchor className="h-4 w-4" /> Guía marítima · México 🇲🇽
            </p>
            <h1 className="text-balance text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
              Principales puertos marítimos de México: guía 2026
            </h1>
            <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
              Todo lo que un agente de carga, importador o exportador mexicano
              necesita saber sobre los <strong>5 puertos más importantes</strong>{" "}
              del país: Manzanillo, Veracruz, Lázaro Cárdenas, Altamira y
              Ensenada. UN/LOCODE, rutas troncales, navieras presentes y
              vocación de carga.
            </p>
            <p className="mt-3 text-sm text-muted-foreground">
              Actualizado: 18 de junio de 2026 · Lectura: 7 min
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
          <GuiaPuertosMexicoArticle />

          {/* CTA */}
          <aside className="mt-16 rounded-2xl border border-border bg-muted/40 p-8 text-center">
            <h2 className="text-2xl font-bold tracking-tight">
              Opera tus embarques marítimos desde un solo lugar
            </h2>
            <p className="mt-3 text-base text-muted-foreground">
              Libre Carga incluye en su catálogo UN/LOCODE los principales
              puertos mexicanos y mundiales. Crea rutas, contenedores, BL Master
              y documentación operativa sin recapturar datos.
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
