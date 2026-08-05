import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

/**
 * Barra inferior fija para móvil que aparece tras hacer scroll > 50% del viewport.
 * Sólo se renderiza en pantallas chicas (md:hidden).
 */
export function MobileStickyCta() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      const threshold = window.innerHeight * 0.5;
      setVisible(window.scrollY > threshold);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 px-4 py-3 shadow-sticky-top backdrop-blur-md md:hidden"
      role="region"
      aria-label="Acción rápida"
    >
      <Button asChild size="lg" className="w-full">
        <Link to="/login?tab=signup">
          Crear cuenta gratis <ArrowRight className="ml-1 h-4 w-4" />
        </Link>
      </Button>
    </div>
  );
}
