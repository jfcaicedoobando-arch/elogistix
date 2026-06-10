/**
 * Banner persistente para usuarios logueados en la cuenta demo.
 * Se monta globalmente; queda oculto si el usuario no pertenece a la org demo.
 */
import { Sparkles } from "lucide-react";
import { useIsDemoUser } from "@/hooks/useIsDemoUser";

export function DemoModeBanner() {
  const isDemo = useIsDemoUser();
  if (!isDemo) return null;

  return (
    <div
      role="status"
      className="sticky top-0 z-[60] flex items-center justify-center gap-2 bg-accent px-4 py-2 text-center text-xs font-medium text-accent-foreground shadow-sm sm:text-sm"
    >
      <Sparkles className="h-4 w-4" aria-hidden="true" />
      <span>
        Estás en <strong>modo demo</strong> como administrador · datos de ejemplo, se reinician en cada acceso.
      </span>
    </div>
  );
}
