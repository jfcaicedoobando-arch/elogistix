/**
 * Paso 1 del wizard FacturApi: elegir ambiente activo (sandbox vs producción).
 */
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info } from "lucide-react";
import type { FacturapiAmbiente } from "@/features/configuracion/services/facturapiCredenciales";

interface Props {
  ambiente: FacturapiAmbiente;
  onChange: (a: FacturapiAmbiente) => void;
}

export function PasoAmbiente({ ambiente, onChange }: Props) {
  return (
    <div className="space-y-4">
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription className="text-xs">
          El ambiente define contra qué API de FacturApi se timbra.{" "}
          <strong>Sandbox</strong> es para pruebas (no genera CFDI válidos ante el SAT).{" "}
          <strong>Producción</strong> emite CFDI reales y consume folios.
          Empieza siempre en Sandbox y cambia a Producción cuando todo funcione.
        </AlertDescription>
      </Alert>

      <div className="rounded border p-4 space-y-3">
        <Label className="text-sm font-medium">Ambiente activo</Label>
        <div className="flex items-center gap-3">
          <span className={ambiente === "sandbox" ? "font-semibold" : "text-muted-foreground"}>
            Sandbox (pruebas)
          </span>
          <Switch
            checked={ambiente === "live"}
            onCheckedChange={(v) => onChange(v ? "live" : "sandbox")}
            aria-label="Cambiar ambiente"
          />
          <span className={ambiente === "live" ? "font-semibold" : "text-muted-foreground"}>
            Producción
          </span>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Selección actual: <strong>{ambiente === "live" ? "Producción" : "Sandbox"}</strong>.
          Podrás cambiarlo después desde la tarjeta de FacturApi.
        </p>
      </div>
    </div>
  );
}
