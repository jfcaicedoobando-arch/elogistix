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
import { OnboardingForm } from "@/features/onboarding/components/OnboardingForm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Building2 } from "lucide-react";
import { useToast } from "@/hooks/shared";
import { notifyError } from "@/lib/ui/appFeedback";
import { ROUTES } from "@/constants/routes";
import { validateOnboarding } from "@/features/onboarding/lib/onboardingValidation";

export default function Onboarding() {
  const { user, organization, organizationId, loading, refreshProfile } = useAuth();
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
    // Ola 4 · N30: sin org activa no hay onboarding que guardar.
    if (!organizationId) {
      setError("No pudimos determinar tu organización. Recarga la página e inténtalo de nuevo.");
      return;
    }
    setSubmitting(true);
    try {
      await completeOnboarding({ organizationId, rfc: v.rfc, direccion: v.direccion, moneda: v.moneda });
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
          <OnboardingForm
            rfc={rfc}
            onRfcChange={setRfc}
            direccion={direccion}
            onDireccionChange={setDireccion}
            moneda={moneda}
            onMonedaChange={setMoneda}
            error={error}
            submitting={submitting}
            onSubmit={handleSubmit}
            onSkip={handleSkip}
          />
        </CardContent>
      </Card>
    </div>
  );
}
