import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Ship, FileText, Receipt, LayoutDashboard, LogOut, Menu, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import librecargaLogo from "@/assets/librecarga-logo.png";
import { usePortalClienteName, usePortalOrgName } from "@/hooks/usePortalData";
import { useState, useMemo } from "react";
import { ThemeToggle } from "@/components/ThemeToggle";

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

function useBreadcrumbs(pathname: string) {
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
        crumbs.push({ label: "Detalle", href: pathname });
      }
    }

    return crumbs;
  }, [pathname]);
}

export default function PortalLayout() {
  const { signOut, user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { data: clienteName } = usePortalClienteName();
  const { data: orgName } = usePortalOrgName();
  const [mobileOpen, setMobileOpen] = useState(false);
  const breadcrumbs = useBreadcrumbs(location.pathname);

  const handleSignOut = async () => {
    await signOut();
    navigate("/portal/login");
  };

  const initials = clienteName
    ? clienteName.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()
    : user?.email?.slice(0, 2).toUpperCase() ?? "?";

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            {/* Mobile menu trigger */}
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 p-0">
                <div className="flex items-center gap-3 p-4 border-b">
                  <img src={librecargaLogo} alt="Logo" className="h-10 w-10 rounded object-contain" />
                  <div className="flex flex-col leading-tight">
                    <span className="font-semibold text-foreground text-sm">{orgName || "Portal"}</span>
                    <span className="text-[10px] text-muted-foreground">Portal de Cliente</span>
                  </div>
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

            <Link to="/portal" className="flex items-center gap-3">
              <img src={librecargaLogo} alt="Logo" className="h-10 w-10 rounded object-contain" />
              <div className="hidden sm:flex flex-col leading-tight">
                <span className="font-semibold text-foreground text-sm">{orgName || "Portal de Cliente"}</span>
                {orgName && <span className="text-[10px] text-muted-foreground">Portal de Cliente</span>}
              </div>
            </Link>
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

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex flex-col items-end text-sm leading-tight">
              {clienteName && <span className="font-medium text-foreground text-xs">{clienteName}</span>}
              <span className="text-[10px] text-muted-foreground">{user?.email}</span>
            </div>
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-accent/10 text-accent text-xs font-semibold">{initials}</AvatarFallback>
            </Avatar>
            <ThemeToggle />
            <Button variant="ghost" size="sm" onClick={handleSignOut} className="hidden sm:flex">
              <LogOut className="h-4 w-4 mr-1" /> Salir
            </Button>
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
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Outlet />
      </main>
    </div>
  );
}
