import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useBreadcrumbLabels } from "@/contexts/BreadcrumbContext";
import { usePortalClienteName, usePortalOrgName } from "@/hooks/portal";
import { APP_VERSION } from "@/constants/appVersion";
import { PortalHeader } from "./layout/PortalHeader";
import { PortalBreadcrumbsBar } from "./layout/PortalBreadcrumbsBar";
import { usePortalBreadcrumbs } from "./layout/usePortalBreadcrumbs";
import { getActiveSectionLabel } from "./layout/portalNav";

export default function PortalLayout() {
  const { signOut, user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { data: clienteName } = usePortalClienteName();
  const { data: orgName } = usePortalOrgName();
  const [mobileOpen, setMobileOpen] = useState(false);
  const labels = useBreadcrumbLabels();
  const breadcrumbs = usePortalBreadcrumbs(location.pathname, labels);
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
      <PortalHeader
        pathname={location.pathname}
        orgName={orgName}
        activeSection={activeSection}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
        initials={initials}
        clienteName={clienteName}
        email={user?.email}
        onSignOut={handleSignOut}
      />

      <PortalBreadcrumbsBar breadcrumbs={breadcrumbs} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Outlet />
      </main>

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
