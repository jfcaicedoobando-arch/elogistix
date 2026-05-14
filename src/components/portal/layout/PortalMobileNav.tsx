import { Link } from "react-router-dom";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Menu, LogOut } from "lucide-react";
import { BrandLockup } from "@/components/layout/BrandLockup";
import { PORTAL_NAV_ITEMS, isPortalNavItemActive } from "./portalNav";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pathname: string;
  orgName?: string | null;
  onSignOut: () => void;
}

export function PortalMobileNav({ open, onOpenChange, pathname, orgName, onSignOut }: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
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
          {PORTAL_NAV_ITEMS.map((item) => {
            const isActive = isPortalNavItemActive(item.href, pathname);
            return (
              <Link
                key={item.href}
                to={item.href}
                onClick={() => onOpenChange(false)}
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
          <Button variant="ghost" size="sm" className="w-full justify-start" onClick={onSignOut}>
            <LogOut className="h-4 w-4 mr-2" /> Cerrar sesión
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
