import { PageHeader } from "@/components/shared/PageHeader";
import { PageSkeleton } from "@/components/shared/skeletons";
import { Wallet } from "lucide-react";
import { usePortalClientUsers } from "@/features/portal/hooks";
import { EstadoCuentaModule } from "@/features/facturacion/estadoCuenta/components/EstadoCuentaModule";
import { useDocumentTitle } from "@/hooks/shared";

export default function PortalEstadoCuenta() {
  useDocumentTitle('Estado de cuenta');
  const { data: clientUsers = [], isLoading } = usePortalClientUsers();
  const clienteIds = clientUsers.map((cu) => cu.cliente_id);

  if (isLoading) return <PageSkeleton />;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<Wallet className="h-6 w-6 text-accent" />}
        title="Estado de cuenta"
        description="Consulta tus saldos, pagos y anticipos."
      />
      <EstadoCuentaModule
        clienteIds={clienteIds}
        facturaHrefBase="/portal/facturas"
        defaultSoloConSaldo
      />
    </div>
  );
}
