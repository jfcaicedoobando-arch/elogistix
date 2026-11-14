/**
 * Layout del Portal de Brokers: encabezado con marca, correo y salida.
 */
import { Link, NavLink, Outlet, useNavigate } from "react-router";
import { LogOut } from "lucide-react";
import { useAuth } from "@/lib/contexts/AuthContext";
import { BrandLockup } from "@/components/layout/BrandLockup";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/shared/PageContainer";
import { signOutWithFeedback } from "@/lib/auth/signOutWithFeedback";

export default function BrokerLayout() {
  const { signOut, user } = useAuth();
  const navigate = useNavigate();
  const salir = () => signOutWithFeedback(signOut, () => navigate("/login"));

  return (
    <div className="min-h-dvh bg-background flex flex-col">
      <header className="border-b bg-card sticky top-0 z-50 shadow-card">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 flex items-center justify-between h-14 sm:h-16 gap-2">
          <Link to="/broker" className="flex items-center min-w-0">
            <BrandLockup variant="horizontal" size="sm" subtitle="Portal de Brokers" />
          </Link>
          <nav className="flex items-center gap-1" aria-label="Portal de Brokers">
            <Button asChild variant="ghost" size="sm"><NavLink to="/broker" end>Mis empresas</NavLink></Button>
            <Button asChild variant="ghost" size="sm"><NavLink to="/broker/consultar">Consultar empresa</NavLink></Button>
            <Button asChild variant="ghost" size="sm"><NavLink to="/broker/comisiones">Comisiones</NavLink></Button>
          </nav>
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline text-body-sm text-muted-foreground truncate max-w-[220px]">
              {user?.email}
            </span>
            <ThemeToggle />
            <Button variant="ghost" size="sm" onClick={salir}>
              <LogOut className="h-4 w-4" />
              Salir
            </Button>
          </div>
        </div>
      </header>
      <main className="flex-1">
        <PageContainer>
          <Outlet />
        </PageContainer>
      </main>
    </div>
  );
}
