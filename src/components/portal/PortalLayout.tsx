import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Ship, FileText, Receipt, LayoutDashboard, LogOut, Menu, ChevronRight, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BrandLockup } from "@/components/layout/BrandLockup";
import { usePortalClienteName, usePortalOrgName } from "@/hooks/portal/usePortalData";
import { useState, useMemo } from "react";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { useBreadcrumbLabels } from "@/contexts/BreadcrumbContext";
import { APP_VERSION } from "@/constants/appVersion";

const navItems = [
  { label: "Inicio", href: "/portal", icon: LayoutDashboard },
  { label: "Embarques", href: "/portal/embarques", icon: Ship },
  { label: "Cotizaciones", href: "/portal/cotizaciones", icon: FileText },
  { label: "Facturas", href: "/portal/facturas", icon: Receipt },
];

const breadcrumbMap: Record<string, string> = {
  "/portal": "Inicio",
  "/portal/embarques": "Embarques",
  "/portal/cotizaciones": "Cotizaciones",
  "/portal/facturas": "Facturas",
};

function useBreadcrumbs(pathname: string, labels: Record<string, string>) {
  return useMemo(() => {
    const parts = pathname.split("/").filter(Boolean);
    const crumbs: { label: string; href: string }[] = [];

    if (parts[0] === "portal") {
      crumbs.push({ label: "Inicio", href: "/portal" });

      if (parts.length >= 2) {
        const section = `/portal/${parts[1]}`;
        const sectionLabel = breadcrumbMap[section];
        if (sectionLabel) {
          crumbs.push({ label: sectionLabel, href: section });
        }
      }

      if (parts.length >= 3) {
        const idSeg = parts[2];
        crumbs.push({ label: labels[idSeg] ?? "Detalle", href: pathname });
      }
    }

    return crumbs;
  }, [pathname, labels]);
}

function getActiveSectionLabel(pathname: string): string | null {
  if (pathname === "/portal") return "Inicio";
  for (const item of navItems) {
    if (item.href !== "/portal" && pathname.startsWith(item.href)) return item.label;
  }
  return null;
}

export default function PortalLayout() {
  const { signOut, user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { data: clienteName } = usePortalClienteName();
  const { data: orgName } = usePortalOrgName();
  const [mobileOpen, setMobileOpen] = useState(false);
  const labels = useBreadcrumbLabels();
  const breadcrumbs = useBreadcrumbs(location.pathname, labels);
  const activeSection = getActiveSectionLabel(location.pathname);

  const handleSignOut = async () => {
    await signOut();
    navigate("/portal/login");
  };

  const initials = clienteName
    ? clienteName.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()
    : user?.email?.slice(0, 2).toUpperCase() ?? "?";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 flex items-center justify-between h-14 sm:h-16 gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {/* Mobile menu trigger */}
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden shrink-0" aria-label="Abrir menú">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 p-0">
                <div className="p-4 border-b">
                  <BrandLockup
                    variant="horizontal"
                    size="sm"
                    subtitle={orgName ? `Portal · ${orgName}` : "Portal de Cliente"}
                  />
                </div>
                <nav className="flex flex-col p-2 gap-1">
                  {navItems.map((item) => {
                    const isActive =
                      item.href === "/portal"
                        ? location.pathname === "/portal"
                        : location.pathname.startsWith(item.href);
                    return (
                      <Link
                        key={item.href}
                        to={item.href}
                        onClick={() => setMobileOpen(false)}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                          isActive
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
                <Separator />
                <div className="p-4">
                  <Button variant="ghost" size="sm" className="w-full justify-start" onClick={handleSignOut}>
                    <LogOut className="h-4 w-4 mr-2" /> Cerrar sesión
                  </Button>
                </div>
              </SheetContent>
            </Sheet>

            {/* Desktop: brand lockup. Mobile: brand compacta + sección activa */}
            <Link to="/portal" className="flex items-center min-w-0">
              <span className="hidden md:flex">
                <BrandLockup
                  variant="horizontal"
                  size="sm"
                  subtitle={orgName ? `Portal · ${orgName}` : "Portal de Cliente"}
                />
              </span>
              <span className="md:hidden">
                <BrandLockup variant="icon" size="sm" />
              </span>
            </Link>
            {activeSection && (
              <span className="md:hidden text-sm font-semibold text-foreground truncate ml-1">
                {activeSection}
              </span>
            )}
          </div>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const isActive =
                item.href === "/portal"
                  ? location.pathname === "/portal"
                  : location.pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
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
            <ThemeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="px-1.5 sm:px-2 gap-2"
                  aria-label="Menú de usuario"
                >
                  <Avatar className="h-7 w-7">
                    <AvatarFallback className="bg-primary text-primary-foreground text-[11px] font-semibold">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuLabel className="flex flex-col gap-0.5">
                  {clienteName && (
                    <span className="text-sm font-semibold leading-tight">{clienteName}</span>
                  )}
                  <span className="text-[11px] font-normal text-muted-foreground truncate">
                    {user?.email}
                  </span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem disabled className="opacity-60">
                  <UserIcon className="h-4 w-4 mr-2" /> Mi perfil
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleSignOut}
                  className="text-destructive focus:text-destructive focus:bg-destructive/10"
                >
                  <LogOut className="h-4 w-4 mr-2" /> Cerrar sesión
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Breadcrumbs */}
      {breadcrumbs.length > 1 && (
        <div className="border-b bg-muted/30">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 flex items-center gap-1 text-xs text-muted-foreground">
            {breadcrumbs.map((crumb, i) => (
              <span key={crumb.href} className="flex items-center gap-1">
                {i > 0 && <ChevronRight className="h-3 w-3" />}
                {i === breadcrumbs.length - 1 ? (
                  <span className="text-foreground font-medium">{crumb.label}</span>
                ) : (
                  <Link to={crumb.href} className="hover:text-foreground transition-colors">{crumb.label}</Link>
                )}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="border-t bg-card/40 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-col sm:flex-row items-center justify-between gap-1 text-[11px] text-muted-foreground">
          <span>
            © {new Date().getFullYear()} {orgName ?? "Libre Carga"} · Portal de Cliente
          </span>
          <span className="tabular-nums">v{APP_VERSION}</span>
        </div>
      </footer>
    </div>
  );
}
