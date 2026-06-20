import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { BrandLockup } from "@/components/layout/BrandLockup";
import { BRAND } from "@/components/shared/utils/brand";
import { Seo } from "@/components/seo/Seo";
import { ForgotPasswordDialog } from "@/features/auth/components/ForgotPasswordDialog";
import { LoginForm } from "@/features/auth/components/LoginForm";
import { SignupForm } from "@/features/auth/components/SignupForm";

type TabKey = "login" | "signup";

export default function Login() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab: TabKey = searchParams.get("tab") === "signup" ? "signup" : "login";
  const [tab, setTab] = useState<TabKey>(initialTab);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [lastEmail, setLastEmail] = useState("");

  const handleTabChange = (value: string) => {
    const next = (value === "signup" ? "signup" : "login") as TabKey;
    setTab(next);
    const params = new URLSearchParams(searchParams);
    if (next === "signup") params.set("tab", "signup");
    else params.delete("tab");
    setSearchParams(params, { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted px-4 py-8">
      <Seo
        title="Iniciar sesión · Libre Carga"
        description="Accede a tu cuenta de Libre Carga: opera embarques, cotizaciones y clientes desde un solo lugar."
        canonical="https://librecarga.com/login"
        ogTitle="Iniciar sesión · Libre Carga"
        ogDescription="Accede a tu cuenta de Libre Carga para gestionar tus embarques."
        ogUrl="https://librecarga.com/login"
      />
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center space-y-4 pb-4">
          <BrandLockup variant="stacked" size="md" subtitle={BRAND.tagline} />
          <h1 className="sr-only">Iniciar sesión en Libre Carga</h1>
        </CardHeader>
        <CardContent className="pt-2">
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
        </CardContent>
      </Card>

      <ForgotPasswordDialog open={forgotOpen} onOpenChange={setForgotOpen} defaultEmail={lastEmail} />
    </div>
  );
}
