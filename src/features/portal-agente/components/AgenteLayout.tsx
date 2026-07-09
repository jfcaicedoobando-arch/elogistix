/**
 * Layout del Portal del Agente de Carga.
 * Header minimal con BrandLockup + nav + logout. Sin sidebar.
 */
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Ship, FileText, ShieldCheck, LayoutDashboard, User, LogOut, Building2 } from "lucide-react";
import { useAuth } from "@/lib/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { BrandLockup } from "@/components/layout/BrandLockup";
import { APP_VERSION } from "@/constants/appVersion";
import { useAgenteContext } from "@/features/portal-agente/hooks";

const NAV = [
  { label: "Inicio", href: "/agente", icon: LayoutDashboard },
  { label: "Tarifas", href: "/agente/tarifas", icon: FileText },
  { label: "Garantías", href: "/agente/garantias", icon: ShieldCheck },
  { label: "Embarques", href: "/agente/embarques", icon: Ship },
  { label: "Perfil", href: "/agente/perfil", icon: User },
];

function isActive(href: string, pathname: string) {
  return href === "/agente" ? pathname === "/agente" : pathname.startsWith(href);
}

export default function AgenteLayout() {
  const { signOut, user } = useAuth();
  const { data: ctx } = useAgenteContext();
  const location = useLocation();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b bg-card sticky top-0 z-50 shadow-card">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 flex items-center justify-between h-14 sm:h-16 gap-2">
          <Link to="/agente" className="flex items-center min-w-0">
            <BrandLockup
              variant="horizontal"
              size="sm"
              subtitle={ctx?.agenteNombre ? `Portal Agente · ${ctx.agenteNombre}` : "Portal del Agente"}
            />
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {NAV.map((item) => {
              const active = isActive(item.href, location.pathname);
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    active
                      ? "bg-accent/10 text-accent"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            {ctx?.organizacionNombre && (
              <span
                className="hidden sm:inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/60 text-xs font-medium text-foreground max-w-[200px]"
                title={ctx.organizacionNombre}
              >
                <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="truncate">{ctx.organizacionNombre}</span>
              </span>
            )}
            <ThemeToggle />
            <span className="hidden sm:inline text-xs text-muted-foreground max-w-[180px] truncate">
              {user?.email}
            </span>
            <Button variant="ghost" size="icon" onClick={handleSignOut} aria-label="Cerrar sesión">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {ctx?.organizacionNombre && (
          <div className="md:hidden border-t bg-muted/30 px-3 py-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Building2 className="h-3 w-3 shrink-0" />
            <span className="truncate font-medium text-foreground">{ctx.organizacionNombre}</span>
          </div>
        )}

        <nav className="md:hidden border-t bg-card/80 px-2 py-1 flex items-center gap-1 overflow-x-auto">
          {NAV.map((item) => {
            const active = isActive(item.href, location.pathname);
            return (
              <Link
                key={item.href}
                to={item.href}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium whitespace-nowrap ${
                  active ? "bg-accent/10 text-accent" : "text-muted-foreground"
                }`}
              >
                <item.icon className="h-3.5 w-3.5" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>

      <main className="flex-1 max-w-screen-2xl w-full mx-auto px-4 sm:px-6 py-6">
        <Outlet />
      </main>

      <footer className="border-t bg-card/40 mt-auto">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between text-[11px] text-muted-foreground">
          <span>© {new Date().getFullYear()} Libre Carga · Portal del Agente</span>
          <span className="tabular-nums">v{APP_VERSION}</span>
        </div>
      </footer>
    </div>
  );
}
