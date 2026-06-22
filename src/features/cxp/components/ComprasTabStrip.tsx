/**
 * Tira de pestañas del módulo Compras. Se inyecta en cada página del módulo
 * (Compras, Proveedores, CxP, Por capturar, Por pagar) para unificar la navegación.
 */
import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Truck, Inbox, Receipt, Landmark } from "lucide-react";

const TABS = [
  { to: "/compras", label: "Resumen", icon: LayoutDashboard, match: (p: string) => p === "/compras" },
  { to: "/proveedores", label: "Proveedores", icon: Truck, match: (p: string) => p.startsWith("/proveedores") },
  { to: "/cxp/por-capturar", label: "Por capturar", icon: Inbox, match: (p: string) => p === "/cxp/por-capturar" },
  { to: "/cxp", label: "Facturas", icon: Receipt, match: (p: string) => p === "/cxp" },
  { to: "/cxp/por-pagar", label: "Por pagar", icon: Landmark, match: (p: string) => p === "/cxp/por-pagar" },
];

export function ComprasTabStrip() {
  const { pathname } = useLocation();
  return (
    <nav className="border-b -mx-1 px-1 overflow-x-auto" aria-label="Navegación de Compras">
      <ul className="flex gap-1 min-w-max">
        {TABS.map((t) => {
          const active = t.match(pathname);
          return (
            <li key={t.to}>
              <NavLink
                to={t.to}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors -mb-px",
                  active
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30",
                )}
              >
                <t.icon className="h-4 w-4" />
                {t.label}
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
