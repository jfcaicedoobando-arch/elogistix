/**
 * Onboarding inicial post-registro. Captura RFC, dirección y moneda
 * preferida de la agencia recién creada antes de entrar a /inicio.
 * Sólo accesible para admins de organización cuyo onboarding no ha sido
 * completado. Si ya lo completaron, redirige a /inicio.
 */
import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/contexts/AuthContext";
import { Seo } from "@/components/shared/Seo";
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
import { notifyError } from "@/lib/ui/appFeedback";
import { ROUTES } from "@/constants/routes";
import { validateOnboarding } from "@/features/onboarding/lib/onboardingValidation";

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

  const submit = async (opts: { skipFiscal: boolean }) => {
    setError(null);
    const v = validateOnboarding({ rfc, direccion, moneda, skipFiscal: opts.skipFiscal });
    if (!v.ok) {
      setError(v.message);
      return;
    }
    setSubmitting(true);
    try {
      await completeOnboarding({ rfc: v.rfc, direccion: v.direccion, moneda: v.moneda });
      await refreshProfile();
      toast({
        title: opts.skipFiscal ? "¡Bienvenido!" : "¡Listo!",
        description: opts.skipFiscal
          ? "Puedes completar tus datos fiscales después en Configuración."
          : "Configuración inicial completada.",
      });
      navigate(ROUTES.INICIO, { replace: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "No pudimos guardar los datos.";
      setError(msg);
      notifyError(undefined, {
        title: "Error al completar onboarding",
        description: msg,
        error: err,
        method: "COMPLETE_ONBOARDING",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void submit({ skipFiscal: false });
  };

  const handleSkip = () => {
    void submit({ skipFiscal: true });
  };

  return (
    <div className="min-h-dvh bg-muted/30 flex items-center justify-center p-4">
      <Seo
        title="Configura tu agencia · Libre Carga"
        description="Completa los datos de tu agencia de carga (RFC, dirección y moneda) para empezar a operar embarques y cotizaciones en Libre Carga."
        canonical="https://librecarga.com/onboarding"
        ogTitle="Configura tu agencia · Libre Carga"
        ogDescription="Últimos datos de tu agencia antes de empezar a operar embarques y cotizaciones en Libre Carga."
        ogUrl="https://librecarga.com/onboarding"
      />
      <Card className="w-full max-w-xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Building2 className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>Completa los datos de tu agencia</CardTitle>
          <CardDescription>
            {organization?.nombre ? `Configuremos ${organization.nombre} ` : "Configuremos tu organización "}
            antes de continuar. El RFC y la dirección son opcionales: puedes llenarlos ahora o dejarlo para después desde Configuración.
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
              <Label htmlFor="onb-rfc">
                RFC <span className="text-xs font-normal text-muted-foreground">(opcional)</span>
              </Label>
              <Input
                id="onb-rfc"
                value={rfc}
                onChange={(e) => setRfc(e.target.value.toUpperCase())}
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
                onChange={(e) => setDireccion(e.target.value)}
                placeholder="Calle, número, colonia, ciudad, estado, código postal"
                rows={3}
                maxLength={500}
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

            <div className="flex flex-col gap-2 pt-2 sm:flex-row-reverse">
              <Button type="submit" className="flex-1" disabled={submitting}>
                {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Guardar y continuar
              </Button>
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={handleSkip}
                disabled={submitting}
              >
                Configurar después
              </Button>
            </div>
            <p className="text-center text-xs text-muted-foreground">
              Puedes explorar la app y completar tus datos fiscales cuando quieras.
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
