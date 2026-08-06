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
      <ul className="grid grid-cols-5">
        {PORTAL_NAV_ITEMS.map((item) => {
          const isActive = isPortalNavItemActive(item.href, pathname);
          const Icon = item.icon;
          return (
            <li key={item.href} className="flex">
              <Link
                to={item.href}
                className={`flex flex-col items-center justify-center gap-1 py-2.5 px-1 text-label font-medium transition-colors w-full min-h-14 ${
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
                  <Icon className="h-5 w-5" />
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
