/**
 * Landing pública. Compone las secciones de marketing.
 * SEO via head estático de index.html.
 */
import { LandingNav } from "./sections/LandingNav";
import { LandingHero } from "./sections/LandingHero";
import { LandingDemo } from "./sections/LandingDemo";
import { LandingModulos } from "./sections/LandingModulos";
import { LandingComoFunciona } from "./sections/LandingComoFunciona";
import { LandingMexico } from "./sections/LandingMexico";
import { LandingPortal } from "./sections/LandingPortal";
import { LandingSeguridad } from "./sections/LandingSeguridad";
import { LandingPrecio } from "./sections/LandingPrecio";
import { LandingFaq } from "./sections/LandingFaq";
import { LandingCtaFinal } from "./sections/LandingCtaFinal";
import { LandingFooter } from "./sections/LandingFooter";
import { MobileStickyCta } from "./sections/MobileStickyCta";

export default function Landing() {
  return (
    <div className="landing-scope min-h-screen bg-background text-foreground">
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
