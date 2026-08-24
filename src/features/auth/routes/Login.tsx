import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Seo } from "@/components/shared/Seo";
import { AuthCard } from "@/features/auth/components/AuthCard";
import { ForgotPasswordDialog } from "@/features/auth/components/ForgotPasswordDialog";
import { LoginForm } from "@/features/auth/components/LoginForm";
import { SignupForm } from "@/features/auth/components/SignupForm";

type TabKey = "login" | "signup";

/**
 * Ola 3 · O3.13 — login contextual por audiencia. El subtítulo se muestra
 * cuando la ruta trae `?audiencia=…` (redirección directa de /portal/login o
 * del guard `PortalProtectedRoute`/`AgenteProtectedRoute` con deep-link).
 * El nombre de la org no está disponible sin sesión; si llega a estarlo,
 * se puede componer "Portal de clientes — {Org}" aquí.
 */
const SUBTITULOS_AUDIENCIA: Record<string, string> = {
  cliente: "Portal de clientes",
  agente: "Portal de agentes",
};

export default function Login() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab: TabKey = searchParams.get("tab") === "signup" ? "signup" : "login";
  const [tab, setTab] = useState<TabKey>(initialTab);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [lastEmail, setLastEmail] = useState("");
  const subtituloAudiencia = SUBTITULOS_AUDIENCIA[searchParams.get("audiencia") ?? ""];

  const handleTabChange = (value: string) => {
    const next = (value === "signup" ? "signup" : "login") as TabKey;
    setTab(next);
    const params = new URLSearchParams(searchParams);
    if (next === "signup") params.set("tab", "signup");
    else params.delete("tab");
    setSearchParams(params, { replace: true });
  };

  return (
    <>
      <Seo
        title="Iniciar sesión · Libre Carga"
        description="Accede a tu cuenta de Libre Carga: opera embarques, cotizaciones y clientes desde un solo lugar."
        canonical="https://librecarga.com/login"
        ogTitle="Iniciar sesión · Libre Carga"
        ogDescription="Accede a tu cuenta de Libre Carga para gestionar tus embarques."
        ogUrl="https://librecarga.com/login"
      />
      <AuthCard title="Iniciar sesión en Libre Carga">
        {/* Ola 3 · O3.13 — login contextual: /portal/login llega con
            ?audiencia=cliente y los guards (PortalProtectedRoute /
            AgenteProtectedRoute) redirigen con la audiencia de su portal.
            La ruta destino se conserva vía location.state.from (LoginForm). */}
        {subtituloAudiencia && (
          <p className="text-center text-body-sm text-muted-foreground -mt-2 mb-4">
            {subtituloAudiencia}
          </p>
        )}
        <Tabs value={tab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="login">Iniciar sesión</TabsTrigger>
            <TabsTrigger value="signup">Crear cuenta</TabsTrigger>
          </TabsList>

          <TabsContent value="login">
            <LoginForm onForgotPassword={() => setForgotOpen(true)} onEmailChange={setLastEmail} />
          </TabsContent>

          <TabsContent value="signup">
            <SignupForm />
          </TabsContent>
        </Tabs>
      </AuthCard>

      <ForgotPasswordDialog open={forgotOpen} onOpenChange={setForgotOpen} defaultEmail={lastEmail} />
    </>
  );
}
