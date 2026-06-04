/**
 * Landing pública. Compone las secciones de marketing y aplica SEO via Helmet
 * cuando esté disponible; si no, depende del head estático de index.html.
 */
import { LandingNav } from "./sections/LandingNav";
import { LandingHero } from "./sections/LandingHero";
import { LandingModulos } from "./sections/LandingModulos";
import { LandingComoFunciona } from "./sections/LandingComoFunciona";
import { LandingMexico } from "./sections/LandingMexico";
import { LandingPortal } from "./sections/LandingPortal";
import { LandingSeguridad } from "./sections/LandingSeguridad";
import { LandingPrecio } from "./sections/LandingPrecio";
import { LandingFaq } from "./sections/LandingFaq";
import { LandingCtaFinal } from "./sections/LandingCtaFinal";
import { LandingFooter } from "./sections/LandingFooter";

export default function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <LandingNav />
      <main>
        <LandingHero />
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
    </div>
  );
}
