import { useParams, Link } from "react-router-dom";
import { PageContainer } from "@/components/shared/PageContainer";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Wallet } from "lucide-react";
import { EstadoCuentaModule } from "../components/EstadoCuentaModule";

export default function EstadoCuentaInterno() {
  const { clienteId = "" } = useParams<{ clienteId: string }>();

  return (
    <PageContainer width="wide">
      <PageHeader
        icon={<Wallet className="h-6 w-6 text-primary" />}
        title="Estado de cuenta"
        description="Movimientos, saldos y anticipos del cliente."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link to={`/clientes/${clienteId}`}>
              <ArrowLeft className="h-4 w-4 mr-1.5" />
              Volver al cliente
            </Link>
          </Button>
        }
      />

      <EstadoCuentaModule
        clienteIds={clienteId ? [clienteId] : []}
        facturaHrefBase="/facturacion"
      />
    </PageContainer>
  );
}
