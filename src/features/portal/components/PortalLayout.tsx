import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useBreadcrumbLabels } from "@/lib/contexts/BreadcrumbContext";
import { usePortalClienteName, usePortalOrgName, usePortalClientUsers } from "@/features/portal/hooks";
import { PortalSinCliente } from "./PortalSinCliente";
import { APP_VERSION } from "@/constants/appVersion";
import { PortalHeader } from "./layout/PortalHeader";
import { PortalBreadcrumbsBar } from "./layout/PortalBreadcrumbsBar";
import { PortalBottomNav } from "./layout/PortalBottomNav";
import { usePortalBreadcrumbs } from "@/features/portal/hooks/usePortalBreadcrumbs";
import { getActiveSectionLabel } from "./layout/portalNav";
import { ROUTES } from "@/constants/routes";

export default function PortalLayout() {
  const { signOut, user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { data: clienteName } = usePortalClienteName();
  const { data: orgName } = usePortalOrgName();
  const { data: clientUsers, isLoading: cargandoVinculo } = usePortalClientUsers();
  const sinClienteVinculado = !cargandoVinculo && (clientUsers?.length ?? 0) === 0;
  const labels = useBreadcrumbLabels();
  const breadcrumbs = usePortalBreadcrumbs(location.pathname, labels);
  const activeSection = getActiveSectionLabel(location.pathname);

  const handleSignOut = async () => {
    await signOut();
    navigate(ROUTES.PORTAL_LOGIN);
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
        initials={initials}
        clienteName={clienteName}
        email={user?.email}
        onSignOut={handleSignOut}
      />

      <div className="hidden sm:block">
        <PortalBreadcrumbsBar breadcrumbs={breadcrumbs} />
      </div>

      <main className="flex-1 max-w-screen-2xl w-full mx-auto px-4 sm:px-6 py-6 pb-24 md:pb-6">
        {sinClienteVinculado ? (
          <PortalSinCliente email={user?.email} onSignOut={handleSignOut} />
        ) : (
          <Outlet />
        )}
      </main>

      <footer className="hidden md:block border-t bg-card/40 mt-auto">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-3 flex flex-col sm:flex-row items-center justify-between gap-1 text-label text-muted-foreground">
          <span>
            © {new Date().getFullYear()} {orgName ?? "Libre Carga"} · Portal de Cliente
          </span>
          <span className="tabular-nums">v{APP_VERSION}</span>
        </div>
      </footer>

      <PortalBottomNav />
    </div>
  );
}
