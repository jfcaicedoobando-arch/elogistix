import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { CTA_FINAL } from "../landingCopy";
import { ProbarDemoButton } from "@/components/marketing/ProbarDemoButton";



export function LandingCtaFinal() {
  return (
    <section className="relative overflow-hidden bg-primary py-20 text-primary-foreground sm:py-24">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-30"
      >
        <div className="absolute left-1/2 top-1/2 h-[28rem] w-[28rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/40 blur-3xl" />
      </div>
      <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-6">
        <h2 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
          {CTA_FINAL.title}
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-lg text-primary-foreground/80">
          {CTA_FINAL.desc}
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button asChild size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90">
            <Link to="/login?tab=signup">
              Crear cuenta gratis <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
          <ProbarDemoButton
            size="lg"
            variant="outline"
            className="border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
          />
        </div>
      </div>
    </section>
  );
}
