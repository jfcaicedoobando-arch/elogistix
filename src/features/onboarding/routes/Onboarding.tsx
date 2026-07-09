/**
 * Onboarding inicial post-registro. Captura RFC, dirección y moneda
 * preferida de la agencia recién creada antes de entrar a /inicio.
 * Sólo accesible para admins de organización cuyo onboarding no ha sido
 * completado. Si ya lo completaron, redirige a /inicio.
 */
import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/contexts/AuthContext";
import { completeOnboarding } from "@/features/onboarding/services/completeOnboarding";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, AlertCircle, Building2 } from "lucide-react";
import { useToast } from "@/hooks/shared";
import { notifyError } from "@/components/shared/utils/appFeedback";
import { ROUTES } from "@/constants/routes";

const MONEDAS = [
  { value: "MXN", label: "Peso mexicano (MXN)" },
  { value: "USD", label: "Dólar estadounidense (USD)" },
  { value: "EUR", label: "Euro (EUR)" },
];

export default function Onboarding() {
  const { user, organization, loading, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [rfc, setRfc] = useState(organization?.rfc ?? "");
  const [direccion, setDireccion] = useState(organization?.direccion ?? "");
  const [moneda, setMoneda] = useState<string>(organization?.moneda_preferida ?? "MXN");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="flex h-dvh items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!user) return <Navigate to={ROUTES.LOGIN} replace />;
  if (organization?.onboarding_completado) return <Navigate to={ROUTES.INICIO} replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const rfcClean = rfc.trim().toUpperCase();
    const dirClean = direccion.trim();
    if (rfcClean.length < 12 || rfcClean.length > 13) {
      setError("El RFC debe tener 12 caracteres (persona moral) o 13 (persona física).");
      return;
    }
    if (dirClean.length < 5 || dirClean.length > 500) {
      setError("La dirección debe tener entre 5 y 500 caracteres.");
      return;
    }
    if (!["MXN", "USD", "EUR"].includes(moneda)) {
      setError("Selecciona una moneda válida.");
      return;
    }
    setSubmitting(true);
    try {
      await completeOnboarding({ rfc: rfcClean, direccion: dirClean, moneda });
      await refreshProfile();
      toast({ title: "¡Listo!", description: "Configuración inicial completada." });
      navigate(ROUTES.INICIO, { replace: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "No pudimos guardar los datos.";
      setError(msg);
      notifyError(toast, {
        title: "Error al completar onboarding",
        description: msg,
        error: err,
        method: "COMPLETE_ONBOARDING",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-dvh bg-muted/30 flex items-center justify-center p-4">
      <Card className="w-full max-w-xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Building2 className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>Completa los datos de tu agencia</CardTitle>
          <CardDescription>
            {organization?.nombre ? `Configuremos ${organization.nombre} ` : "Configuremos tu organización "}
            antes de continuar. Podrás editarlo después en Configuración.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {error && (
              <Alert variant="destructive" role="alert">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="onb-rfc">RFC</Label>
              <Input
                id="onb-rfc"
                value={rfc}
                onChange={(e) => setRfc(e.target.value.toUpperCase())}
                placeholder="XAXX010101000"
                minLength={12}
                maxLength={13}
                required
                autoComplete="off"
              />
              <p className="text-xs text-muted-foreground">
                12 caracteres para persona moral, 13 para persona física.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="onb-direccion">Dirección fiscal</Label>
              <Textarea
                id="onb-direccion"
                value={direccion}
                onChange={(e) => setDireccion(e.target.value)}
                placeholder="Calle, número, colonia, ciudad, estado, código postal"
                rows={3}
                minLength={5}
                maxLength={500}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="onb-moneda">Moneda preferida</Label>
              <Select value={moneda} onValueChange={setMoneda}>
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

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Guardar y continuar
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
