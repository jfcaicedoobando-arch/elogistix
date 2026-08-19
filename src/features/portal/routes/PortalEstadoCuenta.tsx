import { PortalPageShell } from "@/features/portal/components/layout/PortalPageShell";
import { PageSkeleton } from "@/components/shared/skeletons";
import { Wallet } from "lucide-react";
import { usePortalClientUsers } from "@/features/portal/hooks";
import { EstadoCuentaModule } from "@/features/facturacion/estadoCuenta/components/EstadoCuentaModule";
import { useDocumentTitle } from "@/hooks/shared";
import { ErrorState } from "@/components/shared/states/ErrorState";

export default function PortalEstadoCuenta() {
  useDocumentTitle('Estado de cuenta');
  const { data: clientUsers = [], isLoading, isError, refetch } = usePortalClientUsers();
  const clienteIds = clientUsers.map((cu) => cu.cliente_id);

  if (isLoading) return <PageSkeleton />;

  if (isError) {
    return (
      <div className="space-y-6">
        <ErrorState onRetry={() => void refetch()} />
      </div>
    );
  }

  return (
    <PortalPageShell
      icon={<Wallet className="h-6 w-6 text-accent" />}
      title="Estado de cuenta"
      description="Consulta tus saldos, pagos y anticipos."
    >
      <EstadoCuentaModule
        clienteIds={clienteIds}
        facturaHrefBase="/portal/facturas"
        defaultSoloConSaldo
      />
    </PortalPageShell>
  );
}
