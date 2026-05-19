import { Link } from "react-router-dom";
import { BrandLockup } from "@/components/layout/BrandLockup";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { PORTAL_NAV_ITEMS, isPortalNavItemActive } from "./portalNav";
import { PortalMobileNav } from "./PortalMobileNav";
import { PortalUserMenu } from "./PortalUserMenu";
import { PortalNotificationsBell } from "./PortalNotificationsBell";
import { FeedbackButton } from "@/components/feedback/FeedbackButton";

interface Props {
  pathname: string;
  orgName?: string | null;
  activeSection: string | null;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
  initials: string;
  clienteName?: string | null;
  email?: string | null;
  onSignOut: () => void;
}

export function PortalHeader({
  pathname,
  orgName,
  activeSection,
  mobileOpen,
  setMobileOpen,
  initials,
  clienteName,
  email,
  onSignOut,
}: Props) {
  return (
    <header className="border-b bg-card sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 flex items-center justify-between h-14 sm:h-16 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <PortalMobileNav
            open={mobileOpen}
            onOpenChange={setMobileOpen}
            pathname={pathname}
            orgName={orgName}
            onSignOut={onSignOut}
          />

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

        <nav className="hidden md:flex items-center gap-1">
          {PORTAL_NAV_ITEMS.map((item) => {
            const isActive = isPortalNavItemActive(item.href, pathname);
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
          <FeedbackButton />
          <PortalNotificationsBell />
          <PortalUserMenu
            initials={initials}
            clienteName={clienteName}
            email={email}
            onSignOut={onSignOut}
          />
        </div>
      </div>
    </header>
  );
}
