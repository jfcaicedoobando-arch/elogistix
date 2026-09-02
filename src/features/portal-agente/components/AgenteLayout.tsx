/**
 * Layout del Portal del Agente de Carga.
 * v13.226.0 (Lote 6 · D-02, D-12): paridad con `PortalLayout` — breadcrumbs bar,
 * dropdown de usuario con avatar, `FeedbackButton` y footer con org dinámico.
 */
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useMemo } from "react";
import { Ship, FileSpreadsheet, ShieldCheck, LayoutDashboard, User, Building2 } from "lucide-react";
import { useAuth } from "@/lib/contexts/AuthContext";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { BrandLockup } from "@/components/layout/BrandLockup";
import { FeedbackButton } from "@/components/feedback/FeedbackButton";
import { APP_VERSION } from "@/constants/appVersion";
import { useAgenteContext } from "@/features/portal-agente/hooks";
import { PortalUserMenu } from "@/features/portal/components/layout/PortalUserMenu";
import { PortalBreadcrumbsBar } from "@/features/portal/components/layout/PortalBreadcrumbsBar";
import type { PortalCrumb } from "@/features/portal/components/layout/PortalBreadcrumbsBar";
import { useBreadcrumbLabels } from "@/lib/contexts/BreadcrumbContext";
import { PageContainer } from "@/components/shared/PageContainer";
import { Hint } from "@/components/shared/Hint";
import { ROUTES } from "@/constants/routes";

const NAV = [
  { label: "Inicio", href: "/agente", icon: LayoutDashboard },
  { label: "Tarifas", href: "/agente/tarifas", icon: FileSpreadsheet },
  { label: "Garantías", href: "/agente/garantias", icon: ShieldCheck },
  { label: "Embarques", href: "/agente/embarques", icon: Ship },
  { label: "Perfil", href: "/agente/perfil", icon: User },
];

const AGENTE_BREADCRUMB_MAP: Record<string, string> = {
  "/agente": "Inicio",
  "/agente/tarifas": "Tarifas",
  "/agente/garantias": "Garantías",
  "/agente/embarques": "Embarques",
  "/agente/perfil": "Perfil",
};

function isActive(href: string, pathname: string) {
  return href === "/agente" ? pathname === "/agente" : pathname.startsWith(href);
}

function computeInitials(source: string): string {
  return (
    source
      .split(" ")
      .map((w) => w[0])
      .filter(Boolean)
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?"
  );
}

function useAgenteBreadcrumbs(pathname: string, labels: Record<string, string>): PortalCrumb[] {
  return useMemo(() => {
    const parts = pathname.split("/").filter(Boolean);
    const crumbs: PortalCrumb[] = [];
    if (parts[0] === "agente") {
      crumbs.push({ label: "Inicio", href: "/agente" });
      if (parts.length >= 2) {
        const section = `/agente/${parts[1]}`;
        const sectionLabel = AGENTE_BREADCRUMB_MAP[section];
        if (sectionLabel) crumbs.push({ label: sectionLabel, href: section });
      }
      if (parts.length >= 3) {
        const idSeg = parts[2];
        crumbs.push({ label: labels[idSeg] ?? "Detalle", href: pathname });
      }
    }
    return crumbs;
  }, [pathname, labels]);
}

export default function AgenteLayout() {
  const { signOut, user } = useAuth();
  const { data: ctx } = useAgenteContext();
  const location = useLocation();
  const navigate = useNavigate();
  const labels = useBreadcrumbLabels();
  const breadcrumbs = useAgenteBreadcrumbs(location.pathname, labels);

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  const nombreParaIniciales = ctx?.agenteNombre ?? user?.email ?? "";
  const initials = computeInitials(nombreParaIniciales);

  const orgName = ctx?.organizacionNombre ?? null;

  return (
    <div className="min-h-dvh bg-background flex flex-col">
      <header className="border-b bg-card sticky top-0 z-50 shadow-card">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 flex items-center justify-between h-14 sm:h-16 gap-2">
          <Link to="/agente" className="flex items-center min-w-0">
            <span className="hidden md:flex">
              <BrandLockup
                variant="horizontal"
                size="sm"
                subtitle={ctx?.agenteNombre ? `Portal Agente · ${ctx.agenteNombre}` : "Portal del Agente"}
              />
            </span>
            <span className="md:hidden">
              <BrandLockup variant="icon" size="sm" />
            </span>
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
            {orgName && (
              <Hint label={orgName}>
                <span className="hidden sm:inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/60 text-xs font-medium text-foreground max-w-[200px]">
                  <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="truncate">{orgName}</span>
                </span>
              </Hint>
            )}
            <ThemeToggle />
            <FeedbackButton />
            <PortalUserMenu
              initials={initials}
              clienteName={ctx?.agenteNombre ?? null}
              email={user?.email ?? null}
              onSignOut={handleSignOut}
              // VT-17: sin esta prop "Mi perfil" apuntaba al portal cliente
              // (/portal/perfil) y el guard de cliente rebotaba al agente.
              perfilRoute={ROUTES.AGENTE_PERFIL}
            />
          </div>
        </div>

        {orgName && (
          <div className="md:hidden border-t bg-muted/30 px-3 py-1 flex items-center gap-1.5 text-label text-muted-foreground">
            <Building2 className="h-3 w-3 shrink-0" />
            <span className="truncate font-medium text-foreground">{orgName}</span>
          </div>
        )}

        <nav className="md:hidden border-t bg-card/80 px-2 py-1 flex items-center gap-1 overflow-x-auto [mask-image:linear-gradient(to_right,black_0,black_calc(100%-20px),transparent_100%)]">
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

      <div className="hidden sm:block">
        <PortalBreadcrumbsBar breadcrumbs={breadcrumbs} />
      </div>

      <main className="flex-1">
        <PageContainer noSpacing>
          <Outlet />
        </PageContainer>
      </main>

      <footer className="border-t bg-card/40 mt-auto">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between text-label text-muted-foreground">
          <span>© {new Date().getFullYear()} {orgName ?? "Libre Carga"} · Portal del Agente</span>
          <span className="tabular-nums">v{APP_VERSION}</span>
        </div>
      </footer>
    </div>
  );
}
