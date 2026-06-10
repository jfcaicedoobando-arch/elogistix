/**
 * Landing pública. Compone las secciones de marketing.
 * SEO via index.html (defaults) + Helmet (canonical/og:url self-referente + FAQPage JSON-LD).
 */
import { Seo } from "@/components/seo/Seo";
import { LandingNav } from "./sections/LandingNav";
import { LandingHero } from "./sections/LandingHero";
import { LandingDemo } from "./sections/LandingDemo";
import { LandingModulos } from "./sections/LandingModulos";
import { LandingComoFunciona } from "./sections/LandingComoFunciona";
import { LandingMexico } from "./sections/LandingMexico";
import { LandingPortal } from "./sections/LandingPortal";
import { LandingSeguridad } from "./sections/LandingSeguridad";
import { LandingRecursos } from "./sections/LandingRecursos";

const FAQ_JSONLD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};

export default function Landing() {
  return (
    <div className="landing-scope min-h-screen bg-background text-foreground">
      <Seo canonical="https://librecarga.com/" ogUrl="https://librecarga.com/" jsonLd={FAQ_JSONLD} />
      <LandingNav />
      <main>
        <LandingHero />
        <LandingDemo />
        <LandingModulos />
        <LandingComoFunciona />
        <LandingMexico />
        <LandingPortal />
        <LandingSeguridad />
        <LandingPrecio />
        <LandingFaq />
        <LandingCtaFinal />
      </main>
      <LandingFooter />
      <MobileStickyCta />
    </div>
  );
}
