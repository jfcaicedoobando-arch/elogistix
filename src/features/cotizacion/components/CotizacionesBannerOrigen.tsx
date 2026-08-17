/**
 * VB-36: aviso mostrado cuando se llega a /cotizaciones por el redirect de
 * /embarques/nuevo. Explica que los embarques nacen de una cotización aceptada.
 */
import { useState } from "react";
import { useLocation } from "react-router-dom";
import { Info, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CotizacionesBannerOrigen() {
  const location = useLocation();
  const [visible, setVisible] = useState(
    () => (location.state as { origen?: string } | null)?.origen === "nuevo-embarque",
  );

  if (!visible) return null;

  return (
    <div
      role="status"
      className="flex items-start gap-3 rounded-md border border-primary/30 bg-primary/5 p-3 text-sm"
    >
      <Info className="h-4 w-4 mt-0.5 shrink-0 text-primary" aria-hidden />
      <p className="flex-1">
        Los embarques se crean desde una cotización aceptada. Abre una cotización
        con estado <strong>Aceptada</strong> y usa la acción <strong>Crear embarque</strong>.
      </p>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-6 w-6 p-0 shrink-0"
        aria-label="Cerrar aviso"
        onClick={() => setVisible(false)}
      >
        <X className="h-4 w-4" aria-hidden />
      </Button>
    </div>
  );
}
