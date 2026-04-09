import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Ship, FileText, Receipt, LayoutDashboard, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import librecargaLogo from "@/assets/librecarga-logo.png";
import { usePortalClienteName, usePortalOrgName } from "@/hooks/usePortalData";

const navItems = [
  { label: "Inicio", href: "/portal", icon: LayoutDashboard },
  { label: "Embarques", href: "/portal/embarques", icon: Ship },
  { label: "Cotizaciones", href: "/portal/cotizaciones", icon: FileText },
  { label: "Facturas", href: "/portal/facturas", icon: Receipt },
];

export default function PortalLayout() {
  const { signOut, user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { data: clienteName } = usePortalClienteName();

  const handleSignOut = async () => {
    await signOut();
    navigate("/portal/login");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-14">
          <div className="flex items-center gap-3">
            <img src={librecargaLogo} alt="Logo" className="h-8 w-8 rounded object-contain" />
            <span className="font-semibold text-foreground">Portal de Cliente</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground hidden sm:block">
              {clienteName && <span className="font-medium text-foreground">{clienteName}</span>}
              {clienteName && " · "}
              {user?.email}
            </span>
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              <LogOut className="h-4 w-4 mr-1" /> Salir
            </Button>
          </div>
        </div>
      </header>

      {/* Nav */}
      <nav className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex gap-1 overflow-x-auto">
          {navItems.map((item) => {
            const isActive =
              item.href === "/portal"
                ? location.pathname === "/portal"
                : location.pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                to={item.href}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  isActive
                    ? "border-accent text-accent"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                }`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Outlet />
      </main>
    </div>
  );
}
