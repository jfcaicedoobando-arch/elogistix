/**
 * Bottom navigation bar para el portal de cliente en mobile.
 * Sticky bottom, oculta en md+, respeta safe-area-inset-bottom (notch iPhone).
 */
import { Link, useLocation } from "react-router-dom";
import { PORTAL_NAV_ITEMS, isPortalNavItemActive } from "./portalNav";

export function PortalBottomNav() {
  const { pathname } = useLocation();

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-50 border-t bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 pb-[env(safe-area-inset-bottom)]"
      aria-label="Navegación principal"
    >
      <ul className="grid grid-cols-4">
        {PORTAL_NAV_ITEMS.map((item) => {
          const isActive = isPortalNavItemActive(item.href, pathname);
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                to={item.href}
                className={`flex flex-col items-center justify-center gap-0.5 py-2 px-1 text-[10px] font-medium transition-colors ${
                  isActive
                    ? "text-accent"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                aria-current={isActive ? "page" : undefined}
              >
                <span
                  className={`flex h-7 w-12 items-center justify-center rounded-full transition-colors ${
                    isActive ? "bg-accent/10" : ""
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span className="leading-none">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
