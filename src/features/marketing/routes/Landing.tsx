/**
 * Landing pública. Compone las secciones de marketing.
 * SEO via index.html (defaults) + Helmet (canonical/og:url self-referente + FAQPage JSON-LD).
 */
import { Seo } from "@/components/shared/Seo";
import { LandingNav } from "../components/sections/LandingNav";
import { LandingHero } from "../components/sections/LandingHero";
import { LandingAntesDespues } from "../components/sections/LandingAntesDespues";
import { LandingRecorrido } from "../components/sections/LandingRecorrido";
import { LandingDemo } from "../components/sections/LandingDemo";
import { LandingModulos } from "../components/sections/LandingModulos";
import { LandingComoFunciona } from "../components/sections/LandingComoFunciona";
import { LandingPrecio } from "../components/sections/LandingPrecio";
import { LandingMexico } from "../components/sections/LandingMexico";
import { LandingPortal } from "../components/sections/LandingPortal";
import { LandingSeguridad } from "../components/sections/LandingSeguridad";
import { LandingRecursos } from "../components/sections/LandingRecursos";
import { LandingFaq } from "../components/sections/LandingFaq";
import { LandingCtaFinal } from "../components/sections/LandingCtaFinal";
import { LandingFooter } from "../components/sections/LandingFooter";
import { MobileStickyCta } from "../components/sections/MobileStickyCta";
import { FAQ } from "./landingCopy";
import { useCaptureUtmParams } from "../hooks/useUtmParams";

const FAQ_JSONLD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ.map((f: { q: string; a: string }) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};

export default function Landing() {
  useCaptureUtmParams();
  return (
    <div className="landing-scope min-h-dvh bg-background text-foreground">
      <Seo canonical="https://librecarga.com/" ogUrl="https://librecarga.com/" jsonLd={FAQ_JSONLD} />
      <LandingNav />
      <main>
        <LandingHero />
        <LandingAntesDespues />
        <LandingRecorrido />
        <LandingModulos />
        <LandingComoFunciona />
        <LandingPrecio />
        <LandingDemo />
        <LandingMexico />
        <LandingPortal />
        <LandingSeguridad />
        <LandingRecursos />
        <LandingFaq />
        <LandingCtaFinal />
      </main>
      <LandingFooter />
      <MobileStickyCta />
    </div>
  );
}

