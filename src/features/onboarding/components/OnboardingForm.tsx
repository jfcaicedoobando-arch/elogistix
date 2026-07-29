/**
 * Formulario del onboarding inicial. Extraído de `Onboarding.tsx` (Power of 10 #4:
 * archivos productivos ≤ 200 líneas). Es puramente presentacional: recibe estado
 * y handlers por props; la lógica de guardado vive en la ruta.
 */
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertCircle } from "lucide-react";

const MONEDAS = [
  { value: "MXN", label: "Peso mexicano (MXN)" },
  { value: "USD", label: "Dólar estadounidense (USD)" },
  { value: "EUR", label: "Euro (EUR)" },
];

export interface OnboardingFormProps {
  rfc: string;
  onRfcChange: (value: string) => void;
  direccion: string;
  onDireccionChange: (value: string) => void;
  moneda: string;
  onMonedaChange: (value: string) => void;
  error: string | null;
  submitting: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onSkip: () => void;
}

export function OnboardingForm({
  rfc,
  onRfcChange,
  direccion,
  onDireccionChange,
  moneda,
  onMonedaChange,
  error,
  submitting,
  onSubmit,
  onSkip,
}: OnboardingFormProps) {
  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {error && (
        <Alert variant="destructive" role="alert">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="onb-rfc">
          RFC <span className="text-xs font-normal text-muted-foreground">(opcional)</span>
        </Label>
        <Input
          id="onb-rfc"
          value={rfc}
          onChange={(e) => onRfcChange(e.target.value.toUpperCase())}
          placeholder="XAXX010101000"
          maxLength={13}
          autoComplete="off"
        />
        <p className="text-xs text-muted-foreground">
          12 caracteres para persona moral, 13 para persona física. Requerido para emitir facturas.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="onb-direccion">
          Dirección fiscal <span className="text-xs font-normal text-muted-foreground">(opcional)</span>
        </Label>
        <Textarea
          id="onb-direccion"
          value={direccion}
          onChange={(e) => onDireccionChange(e.target.value)}
          placeholder="Calle, número, colonia, ciudad, estado, código postal"
          rows={3}
          maxLength={500}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="onb-moneda">Moneda preferida</Label>
        <Select value={moneda} onValueChange={onMonedaChange}>
          <SelectTrigger id="onb-moneda">
            <SelectValue placeholder="Selecciona una moneda" />
          </SelectTrigger>
          <SelectContent>
            {MONEDAS.map((m) => (
              <SelectItem key={m.value} value={m.value}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Moneda base para mostrar montos por defecto en cotizaciones y embarques.
        </p>
      </div>

      <div className="flex flex-col gap-2 pt-2 sm:flex-row-reverse">
        <Button type="submit" className="flex-1" disabled={submitting}>
          {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          Guardar y continuar
        </Button>
        <Button
          type="button"
          variant="outline"
          className="flex-1"
          onClick={onSkip}
          disabled={submitting}
        >
          Configurar después
        </Button>
      </div>
      <p className="text-center text-xs text-muted-foreground">
        Puedes explorar la app y completar tus datos fiscales cuando quieras.
      </p>
    </form>
  );
}
